// The LoRa radio of this device: connecting it, giving it the active group's channel, and
// feeding the group's events through the airtime scheduler (ARCHITECTURE.md §4.2–4.3,
// ADR-0043). The MeshCore library is loaded with the first connection, not with the app.

import { LIMITS, LoraScheduler, type LoraPacket } from '@tesel/core';
import {
  RadioError,
  type RadioLink,
  type RadioLinkState,
  type ReceivedFrame,
} from '@tesel/meshcore/link';
import { bytesEqual } from '@tesel/protocol';

import { receiveEvents } from '../events/event-log.ts';
import { groupId } from '../groups/group.ts';
import { getGroup } from '../groups/group-store.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import type { LoraSink } from '../sync/lora-events.ts';
import { loadRadioTexts, saveRadioText } from './radio-text-store.ts';
import { MAX_RADIO_TEXTS, type StoredRadioText } from './radio-texts.ts';

/** What the radio needs from the active group's feed. */
export type RadioFeed = Pick<
  GroupFeed,
  'groupId' | 'attachRadio' | 'receiveFromRadio' | 'radioSent' | 'radioChannel'
>;

export type RadioProblem =
  'unsupported' | 'no-free-channel' | 'no-answer' | 'not-paired' | 'failed';

/** How often the scheduler is asked for the next packet, and frames not yet stored retried. */
const PUMP_MS = 1000;
/** Frames heard but not stored yet, at most: storage that keeps failing cannot fill memory. */
const MAX_UNSTORED = 200;
/** Times a frame is tried before it is given up: one that cannot be stored at all must not loop. */
const STORE_ATTEMPTS = 5;

interface Unstored {
  readonly frame: ReceivedFrame;
  readonly attempts: number;
}

/** A link to a MeshCore companion radio over Web Bluetooth. */
async function meshCoreLink(): Promise<RadioLink> {
  const { MeshCoreRadio, webBleConnector } = await import('@tesel/meshcore');
  return new MeshCoreRadio(webBleConnector);
}

export class RadioSession {
  state: RadioLinkState = $state('disconnected');
  name: string | null = $state(null);
  /** True once the group's channel is configured: events flow both ways. */
  linked = $state(false);
  /** True while the link to a radio that was in use is lost and being tried again. */
  reconnecting = $state(false);
  problem: RadioProblem | null = $state(null);
  /** Signal-to-noise ratio of the last packet received, in dB. */
  lastSnr: number | null = $state(null);
  /** Share of the legal airtime (10 % of an hour) used in the last hour, 0 to 1. */
  airtimeUsed = $state(0);
  /** Text messages of other MeshCore apps, oldest first, the newest `MAX_RADIO_TEXTS`. */
  texts: readonly StoredRadioText[] = $state.raw([]);

  readonly #makeLink: () => Promise<RadioLink>;
  /** The link to radios, made at the first connection. */
  #link: RadioLink | null = null;
  readonly #scheduler: LoraScheduler;
  #feed: RadioFeed | null = null;
  #db: AppDb | null = null;
  #pump: ReturnType<typeof setInterval> | null = null;
  #sending = false;
  /** Frames whose storing failed, tried again on the next pump: none is lost to a busy disk. */
  #unstored: Unstored[] = [];
  readonly #sink: LoraSink = {
    offer: (packet, source) => {
      this.#scheduler.offer(packet, source, Date.now());
    },
    heard: (event) => {
      this.#scheduler.heard(event, Date.now());
    },
    observe: (event) => {
      this.#scheduler.observe(event);
    },
  };

  constructor(makeLink: () => Promise<RadioLink> = meshCoreLink, random = Math.random) {
    this.#makeLink = makeLink;
    this.#scheduler = new LoraScheduler({ random });
  }

  /** The link, made once; a second connection while the first is being made keeps the first. */
  async #linkMade(): Promise<RadioLink> {
    const made = this.#link ?? (await this.#makeLink());
    this.#link ??= this.#follow(made);
    return this.#link;
  }

  /** Keeps this session in step with what the link says. */
  #follow(link: RadioLink): RadioLink {
    link.onStateChange((state) => {
      const wasLinked = this.linked;
      this.state = state;
      this.name = link.name;
      if (state !== 'ready') this.#unlink();
      if (state === 'connecting' && wasLinked) this.reconnecting = true;
      if (state === 'disconnected') this.reconnecting = false;
      if (state === 'ready' && this.reconnecting) {
        this.reconnecting = false;
        void this.#linkFeed();
      }
    });
    link.onReceive((frame) => {
      this.lastSnr = frame.snr;
      void this.#store({ frame, attempts: 0 });
    });
    link.onText((text) => {
      const stored = { ...text, receivedAt: Date.now() };
      this.texts = [...this.texts, stored].slice(-MAX_RADIO_TEXTS);
      if (this.#db) void saveRadioText(this.#db, stored);
    });
    return link;
  }

  /** Where heard MeshCore text messages and other groups' events are kept. */
  async useStorage(db: AppDb): Promise<void> {
    this.#db = db;
    this.texts = [...(await loadRadioTexts(db)), ...this.texts].slice(-MAX_RADIO_TEXTS);
  }

  /** Asks the user to pick a radio, connects and links it to the active group. */
  async connect(): Promise<void> {
    this.problem = null;
    try {
      await (await this.#linkMade()).connect();
    } catch (error) {
      // Closing the browser's picker is not a problem worth reporting.
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        console.warn('Radio connection failed', error);
        this.problem = problemOf(error);
      }
      return;
    }
    await this.#linkFeed();
  }

  async disconnect(): Promise<void> {
    await this.#link?.disconnect();
  }

  /**
   * Follows the active group: its channel goes into the radio and its events through it. What
   * was queued stays queued unless the group changes, as for a new alias or role.
   */
  async useFeed(feed: RadioFeed | null): Promise<void> {
    this.#unlink();
    if (feed?.groupId !== this.#feed?.groupId) this.#scheduler.changeGroup();
    this.#feed = feed;
    await this.#linkFeed();
  }

  /**
   * Clears a group's channel from the radio once the group is left, now if a radio is linked,
   * otherwise the next time one is. Only the group's id is kept for that, never its secret.
   */
  async forgetGroup(secret: Uint8Array): Promise<void> {
    const left = groupId(secret);
    const link = this.#link?.state === 'ready' ? this.#link : null;
    if (this.#db === null) {
      await link?.forgetChannels((held) => groupId(held) === left);
      return;
    }
    // Noted first, so that a clear the radio does not finish is tried again the next time.
    const pending = await this.#channelsToFree(this.#db);
    if (!pending.includes(left)) {
      await this.#db.put('settings', [...pending, left], 'radioChannelsToFree');
    }
    if (link !== null) await this.#freeLeftChannels(link);
  }

  async #linkFeed(): Promise<void> {
    const feed = this.#feed;
    const link = this.#link;
    if (feed === null || link?.state !== 'ready') return;
    const { name, secret } = feed.radioChannel;
    try {
      await this.#freeLeftChannels(link);
      await link.configureGroupChannel(name, secret);
    } catch (error) {
      this.problem = problemOf(error);
      return;
    }
    if (this.#feed !== feed) return; // The active group changed meanwhile.
    this.linked = true;
    this.#pump ??= setInterval(() => void this.#tick(), PUMP_MS);
    await feed.attachRadio(this.#sink);
  }

  /** Clears the channels of groups left while no radio was linked. */
  async #freeLeftChannels(link: RadioLink): Promise<void> {
    if (this.#db === null) return;
    const left = await this.#channelsToFree(this.#db);
    if (left.length === 0) return;
    await link.forgetChannels((held) => left.includes(groupId(held)));
    await this.#db.delete('settings', 'radioChannelsToFree');
  }

  async #channelsToFree(db: AppDb): Promise<string[]> {
    const stored = await db.get('settings', 'radioChannelsToFree');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  }

  #unlink(): void {
    void this.#feed?.attachRadio(null);
    this.linked = false;
    if (this.#pump !== null) clearInterval(this.#pump);
    this.#pump = null;
  }

  /**
   * A frame heard on a group's channel: the active group's goes to its feed; another group's,
   * one this device belongs to and whose channel the radio still holds, goes to that group's log
   * for when it is opened.
   */
  async #store({ frame, attempts }: Unstored): Promise<void> {
    try {
      const feed = this.#feed;
      if (feed !== null && bytesEqual(frame.secret, feed.radioChannel.secret)) {
        await feed.receiveFromRadio(frame.bytes);
        return;
      }
      const db = this.#db;
      const group = db === null ? undefined : await getGroup(db, groupId(frame.secret));
      if (db === null || group === undefined) return;
      await receiveEvents(db, group.id, [frame.bytes], { forward: group.server !== null });
    } catch (error) {
      console.warn('Storing a radio frame failed', error);
      storageRefusals.note(error);
      if (attempts + 1 < STORE_ATTEMPTS) {
        this.#unstored = [...this.#unstored, { frame, attempts: attempts + 1 }].slice(
          -MAX_UNSTORED,
        );
      }
    }
  }

  async #tick(): Promise<void> {
    const unstored = this.#unstored;
    this.#unstored = [];
    for (const item of unstored) await this.#store(item);
    await this.#sendNext();
  }

  async #sendNext(): Promise<void> {
    const link = this.#link;
    if (this.#sending || !this.linked || link === null) return;
    const now = Date.now();
    const packet = this.#scheduler.next(now);
    this.airtimeUsed = this.#scheduler.spentMs(now) / LIMITS.urgentBudgetMs;
    if (packet === null) return;
    this.#sending = true;
    try {
      const outcome = await link.send(packet.bytes);
      if (outcome.status === 'sent') await this.#sent(packet);
      else this.#scheduler.retry(Date.now());
    } catch (error) {
      console.warn('Radio send failed', error);
      this.#scheduler.retry(Date.now());
    } finally {
      this.#sending = false;
    }
  }

  async #sent(packet: LoraPacket): Promise<void> {
    this.#scheduler.sent(Date.now());
    try {
      await this.#feed?.radioSent(packet.event);
    } catch (error) {
      // The event did go out; at worst a radio linked later sends it once more.
      console.warn('Recording a radio send failed', error);
    }
  }
}

/** This device's LoRa radio, linked or not (ADR-0048). */
export const radio = new RadioSession();

function problemOf(error: unknown): RadioProblem {
  if (error instanceof RadioError) {
    if (error.code === 'no-free-channel') return 'no-free-channel';
    if (error.code === 'timeout') return 'no-answer';
    if (error.code === 'not-paired') return 'not-paired';
  }
  return 'failed';
}
