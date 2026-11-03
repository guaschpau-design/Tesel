// One group's event log on this device made into a live picture, and kept in sync with the group's
// server (feed-relay.ts) and with a radio: what arrives is stored and applied, and what this device
// publishes goes every way there is. The group feed (group-feed.svelte.ts) owns one and puts the
// actions of a member on top of it.

import {
  EMPTY_STATE,
  isOutlived,
  outlivedEvents,
  reduceAll,
  type GroupState,
  type LoraEvent,
} from '@tesel/core';
import {
  decodeEvent,
  deriveGroupKeys,
  eventRefKey,
  peekHeader,
  type EventRef,
  type GroupKeys,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';
import { SvelteSet } from 'svelte/reactivity';

import { forgetEvents, loadEvents, type Received, type ServerRead } from '../events/event-log.ts';
import { confirmStored, markAired, pendingEvents } from '../events/outbox.ts';
import { publishEvent } from '../events/own-events.ts';
import type { StoredGroup } from '../groups/group.ts';
import { hear, NOTHING_HEARD, type Channel, type Heard } from '../links/heard.ts';
import type { AppDb } from '../storage/app-db.ts';
import { FeedRelay } from './feed-relay.ts';
import { GroupIntake } from './group-intake.ts';
import { openLogFile, sealLogFile, type LogImport } from './log-file.ts';
import { catchUpPackets, loraEventOf, standingEvents, type LoraSink } from './lora-events.ts';
import type { EventBuilder } from './member-events.ts';
import type { RelayStatus, SocketLike } from './relay-types.ts';

/** `local-only` when the group has no server: events stay on this device (and LoRa, later). */
export type FeedStatus = RelayStatus | 'local-only';

/**
 * Where what this device has just sent is: with the group (through the server), on its way by
 * radio, or waiting on the device for a way out.
 */
export type Delivery = 'group' | 'radio' | 'waiting';

export class GroupSync {
  state: GroupState = $state.raw(EMPTY_STATE);
  status: FeedStatus = $state('local-only');
  /** What this device has heard from each member, by channel, since the feed opened. */
  heard: Heard = $state.raw(NOTHING_HEARD);
  /** Own events neither stored by a relay nor put on the air, by event reference key. */
  get undelivered(): ReadonlySet<string> {
    return this.#undelivered;
  }
  readonly #undelivered = new SvelteSet<string>();
  /** Members someone else writes as, seen since the feed opened (group-intake.ts). */
  get impersonated(): ReadonlySet<NodeId> {
    return this.#intake.impersonated;
  }

  readonly #db: AppDb;
  readonly #group: StoredGroup;
  /** This device, whose events are its own to deliver and say nothing new about anyone. */
  readonly #self: NodeId;
  readonly #keys: GroupKeys;
  readonly #relay: FeedRelay | null;
  readonly #intake: GroupIntake;
  #lora: LoraSink | null = null;

  private constructor(
    db: AppDb,
    group: StoredGroup,
    self: NodeId,
    createSocket: ((url: string) => SocketLike) | undefined,
  ) {
    this.#db = db;
    this.#group = group;
    this.#self = self;
    this.#keys = deriveGroupKeys(group.secret);
    this.#intake = new GroupIntake(db, group.id, self, {
      apply: (batch) => this.#apply(batch),
      reload: () => this.#reload(),
    });
    this.#relay =
      group.server === null
        ? null
        : new FeedRelay({
            db,
            groupId: group.id,
            server: group.server,
            keys: this.#keys,
            self,
            createSocket,
            onEvents: (batch, readTo) => this.#receive(batch, readTo),
            onStored: (entry) => {
              this.#undelivered.delete(eventRefKey(entry));
            },
            onStatus: (status) => {
              this.status = status;
            },
          });
  }

  /**
   * Loads the group's log, which forgets what it holds and the state has outlived, as after any
   * batch (ADR-0055). It does not connect to the server yet (`connect`).
   */
  static async load(
    db: AppDb,
    group: StoredGroup,
    self: NodeId,
    createSocket: ((url: string) => SocketLike) | undefined,
  ): Promise<GroupSync> {
    const sync = new GroupSync(db, group, self, createSocket);
    await sync.#apply(await loadEvents(db, group.id));
    // The outbox also holds other members' events this device heard by radio and forwards: those
    // are not its to deliver.
    for (const { entry } of await pendingEvents(db, group.id)) {
      if (entry.origin === self && entry.aired !== true) {
        sync.#undelivered.add(eventRefKey(entry));
      }
    }
    return sync;
  }

  /** Connects to the group's server, if it has one. */
  connect(): void {
    this.#relay?.start();
  }

  close(): void {
    this.#intake.close();
    this.#relay?.stop();
  }

  get delivery(): Delivery {
    if (this.status === 'synced') return 'group';
    return this.#lora === null ? 'waiting' : 'radio';
  }

  /**
   * Connects to a radio, or disconnects with null. While connected, own events go on the air too,
   * and so do events from the server: this device bridges them (ARCHITECTURE.md §4.3). On
   * connecting, the radio is given what it missed while there was none (`catchUpPackets`).
   */
  async attachRadio(sink: LoraSink | null): Promise<void> {
    this.#lora = sink;
    if (sink === null) return;
    const pending = await pendingEvents(this.#db, this.#group.id);
    // The radio may have gone while the outbox was read: what it missed waits for the next one.
    if (this.#lora !== sink) return;
    for (const event of standingEvents(this.state)) sink.observe(event);
    for (const packet of catchUpPackets(this.state, this.#self, pending)) {
      sink.offer(packet, 'own');
    }
  }

  /**
   * An event this device put on the air. For a group without a server the radio is the only way
   * out, so the event leaves the outbox; otherwise the server still has to store it.
   */
  async radioSent(event: LoraEvent): Promise<void> {
    if (event.origin !== this.#self) return;
    const entry = { groupId: this.#group.id, origin: event.origin, seq: event.seq };
    this.#undelivered.delete(eventRefKey(entry));
    if (this.#group.server === null) await confirmStored(this.#db, entry);
    else await markAired(this.#db, entry);
  }

  /** An event heard over the radio. */
  async receiveFromRadio(bytes: Uint8Array): Promise<void> {
    const heard = loraEventOf(bytes);
    if (heard) this.#lora?.heard(heard);
    this.#hear('radio', [bytes]);
    await this.#take([bytes]);
  }

  /**
   * The group's log as a log file: every event this device keeps, which is all but the positions
   * its state has outlived (ADR-0055).
   */
  async exportLog(): Promise<string> {
    return sealLogFile(this.#keys, await loadEvents(this.#db, this.#group.id));
  }

  /** Takes the events of a log file of this group that this device is missing. */
  async importLog(text: string): Promise<LogImport> {
    const opened = openLogFile(this.#keys, text);
    if (!Array.isArray(opened)) return opened;
    const received = await this.#take(opened);
    return { kind: 'loaded', added: received, total: opened.length };
  }

  /** Creates an event of this device, sends it every way there is, and returns its reference. */
  async publish(build: EventBuilder): Promise<EventRef> {
    const header = { origin: this.#self, time: Math.floor(Date.now() / 1000) };
    const { entry, bytes, stored } = await publishEvent(this.#db, this.#group.id, build, header);
    if (!stored) this.#intake.storeHeldLater();
    this.#undelivered.add(eventRefKey(entry));
    const [event] = await this.#apply([bytes]);
    this.#relay?.push(entry, bytes);
    if (event) this.#lora?.offer({ event, bytes }, 'own');
    return { origin: entry.origin, seq: entry.seq };
  }

  /**
   * Events that did not come from the group's server (by radio or from a file): the new ones are
   * stored, applied and, with a server, passed on to it. Returns how many were new.
   */
  async #take(batch: readonly Uint8Array[]): Promise<number> {
    const forward = this.#relay !== null;
    const added = await this.#intake.store(this.#current(batch), { forward });
    for (const { entry, bytes } of added) this.#relay?.push(entry, bytes);
    return added.length;
  }

  /**
   * Events from the group's server: stored with how far they read it, then applied to the picture
   * at once and bridged to the radio. If they cannot be stored, the cursor stays behind them and
   * the server sends them again on reconnecting.
   */
  async #receive(batch: readonly Uint8Array[], readTo: ServerRead): Promise<void> {
    this.#hear('internet', batch);
    let added: Received[];
    try {
      added = await this.#intake.store(this.#current(batch), { readTo });
    } catch (error) {
      // What may save a life reached the picture, held in memory: it goes on the air too.
      this.#bridge(this.#intake.held());
      throw error;
    }
    this.#bridge(added.map(({ bytes }) => bytes));
  }

  /** Offers events from the server to the radio; types this version does not know too (§3.1). */
  #bridge(batch: readonly Uint8Array[]): void {
    for (const bytes of batch) {
      const event = loraEventOf(bytes);
      if (event) this.#lora?.offer({ event, bytes }, 'bridged');
    }
  }

  /** Makes the picture again from the log, after events it was made with gave way to rivals. */
  async #reload(): Promise<void> {
    const events = await loadEvents(this.#db, this.#group.id);
    this.state = EMPTY_STATE;
    await this.#apply(events);
  }

  /** Notes the members heard through a channel; own events are not news about anyone. */
  #hear(channel: Channel, batch: readonly Uint8Array[]): void {
    const headers = batch.flatMap((bytes) => {
      const header = peekHeader(bytes);
      return header.ok && header.value.origin !== this.#self ? [header.value] : [];
    });
    this.heard = hear(this.heard, channel, headers);
  }

  /**
   * Leaves out of a batch the positions the state has outlived (ADR-0055). They change nothing, and
   * may be copies of positions this device has already forgotten, which must not count as new.
   */
  #current(batch: readonly Uint8Array[]): Uint8Array[] {
    return batch.filter((bytes) => {
      const event = decodeEvent(bytes);
      return !(event.ok && isOutlived(this.state, event.value));
    });
  }

  /**
   * Adds events to the picture in one update, so the map redraws once per batch, then forgets what
   * the new picture has outlived (ADR-0055). Returns the events decoded; those of types this
   * version does not know are kept in the log only.
   */
  async #apply(batch: readonly Uint8Array[]): Promise<TeselEvent[]> {
    const events = batch.flatMap((bytes) => {
      const event = decodeEvent(bytes);
      return event.ok ? [event.value] : [];
    });
    if (events.length === 0) return events;
    const before = this.state;
    this.state = reduceAll(before, events);
    const outlived = outlivedEvents(before, this.state, events);
    if (outlived.length > 0) {
      for (const event of outlived) this.#undelivered.delete(eventRefKey(event));
      // Housekeeping: if it fails, the events stay until the group opens again and forgets them.
      await forgetEvents(this.#db, this.#group.id, outlived).catch((error: unknown) => {
        console.warn('Forgetting outlived events failed', error);
      });
    }
    return events;
  }
}
