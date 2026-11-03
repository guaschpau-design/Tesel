// What this device puts on the air: the active group's events through the airtime scheduler
// (ARCHITECTURE.md §4.2), each sealed with its group's keys (ADR-0099) and sent on that group's
// channel, one at a time. An own SOS still open keeps its group's channel, and its repeats, after
// another group is opened (ADR-0104).

import { LIMITS, LoraScheduler, type LoraEvent, type LoraPacket } from '@tesel/core';
import { bytesEqual } from '@tesel/protocol';
import type { RadioLink } from '@tesel/radio';

import type { AppDb } from '../storage/app-db.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import type { LoraSink } from '../sync/lora-events.ts';
import { loadAirtime, saveAirtime } from './airtime-store.ts';
import type { RadioFrames } from './radio-frames.ts';

/** A sealed packet, with the secret of the group that sealed it, whose channel it goes out on. */
interface RadioPacket extends LoraPacket {
  readonly secret: Uint8Array;
}

/** What sending needs of the active group's feed. */
type SendingFeed = Pick<GroupFeed, 'radioChannel' | 'radioSent'>;

/** Where the sender finds the radio and the active group's feed, as they are now. */
interface Sending {
  readonly link: () => RadioLink | null;
  readonly feed: () => SendingFeed | null;
  /** Where the airtime spent is kept, once the database is open. */
  readonly db: () => AppDb | null;
  readonly frames: RadioFrames;
  readonly random: () => number;
}

export class RadioSender {
  /** Share of the legal airtime (10 % of an hour) used in the last hour, 0 to 1. */
  airtimeUsed = $state(0);

  readonly #sending: Sending;
  readonly #scheduler: LoraScheduler<RadioPacket>;
  /** True while a packet is with the radio. */
  #busy = false;

  /** What the active group's feed offers the radio, and tells it of what it heard. */
  readonly sink: LoraSink = {
    offer: (packet, source) => {
      const secret = this.#sending.feed()?.radioChannel.secret;
      const bytes = secret === undefined ? null : this.#sending.frames.seal(secret, packet.bytes);
      // An event written before frames were sealed may be too large for one: it stays off the
      // air, but what it says still counts, as an SOS whose answers are urgent.
      if (secret === undefined || bytes === null) this.#scheduler.observe(packet.event);
      else this.#scheduler.offer({ event: packet.event, bytes, secret }, source, Date.now());
    },
    heard: (event) => {
      this.#scheduler.heard(event, Date.now());
    },
    observe: (event) => {
      this.observe(event);
    },
  };

  constructor(sending: Sending) {
    this.#sending = sending;
    this.#scheduler = new LoraScheduler({
      random: sending.random,
      // Each kind of radio puts an event on the air its own way. Without a radio nothing goes out.
      airtimeMs: (bytes) => sending.link()?.airtimeMs(bytes) ?? Number.POSITIVE_INFINITY,
    });
  }

  /** The radio carries another group now; see `LoraScheduler.changeGroup`. */
  changeGroup(): void {
    this.#scheduler.changeGroup();
  }

  /** An event arrived by any way: an answer ends the repeats of the SOS it answers. */
  observe(event: LoraEvent): void {
    this.#scheduler.observe(event);
  }

  /**
   * Counts the airtime this device's radio used in the last hour as kept on the device, by an
   * earlier run of the app or another window: the duty cycle is the radio's (ADR-0111).
   */
  async restoreAirtime(): Promise<void> {
    const db = this.#sending.db();
    if (db === null) return;
    try {
      this.#scheduler.restoreAirtime(await loadAirtime(db), Date.now());
    } catch (error) {
      console.warn('Reading the airtime spent failed', error);
    }
  }

  /** The group of `secret` was left: nothing more of it goes out, own SOS calls included. */
  forget(secret: Uint8Array): void {
    this.#scheduler.forget((packet) => bytesEqual(packet.secret, secret));
  }

  /** Puts the next packet due on the air, if one is due and the radio is free. */
  async sendNext(): Promise<void> {
    const link = this.#sending.link();
    if (this.#busy || link === null) return;
    const now = Date.now();
    const packet = this.#scheduler.next(now);
    this.airtimeUsed = this.#scheduler.spentMs(now) / LIMITS.urgentBudgetMs;
    if (packet === null) return;
    this.#busy = true;
    try {
      const outcome = await link.send(packet.bytes, packet.secret);
      if (outcome.status === 'sent') await this.#sent(packet);
      else this.#scheduler.retry(Date.now());
    } catch (error) {
      console.warn('Radio send failed', error);
      this.#scheduler.retry(Date.now());
    } finally {
      this.#busy = false;
    }
  }

  async #sent(packet: RadioPacket): Promise<void> {
    const now = Date.now();
    this.#scheduler.sent(now);
    this.#keepAirtime(now);
    const feed = this.#sending.feed();
    // An own SOS of a group no longer open went on its channel: that group's feed is closed.
    if (feed === null || !bytesEqual(packet.secret, feed.radioChannel.secret)) return;
    try {
      await feed.radioSent(packet.event);
    } catch (error) {
      // The event did go out; at worst a radio linked later sends it once more.
      console.warn('Recording a radio send failed', error);
    }
  }

  /** Keeps the airtime spent on the device; without room, it counts while the app runs. */
  #keepAirtime(now: number): void {
    const db = this.#sending.db();
    if (db === null) return;
    saveAirtime(db, this.#scheduler.airtimeUses(now)).catch((error: unknown) => {
      console.warn('Keeping the airtime spent failed', error);
    });
  }
}
