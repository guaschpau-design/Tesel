// The LoRa radio of this device: connecting it, giving it the active group's channel, and
// feeding the group's events through the airtime scheduler (radio-sender.svelte.ts,
// ARCHITECTURE.md §4.2–4.3, ADR-0043), sealed on the way out and opened on the way in (ADR-0099).
// The code of each kind of radio is loaded when a radio of that kind is picked, not with the app
// (radio-families.ts).

import { bytesEqual } from '@tesel/protocol';
import type { RadioFamily, RadioLink, RadioLinkState } from '@tesel/radio';

import { receiveEvents } from '../events/event-log.ts';
import { groupId } from '../groups/group.ts';
import { getGroup } from '../groups/group-store.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { sosNewsIn, type SosElsewhere } from './heard-elsewhere.ts';
import { freeLeftChannels, noteLeftChannel } from './left-channels.ts';
import { pickedRadioLink } from './radio-families.ts';
import { RadioFrames } from './radio-frames.ts';
import { claimRadio, type RadioRelease } from './radio-lock.ts';
import { problemOf, type RadioProblem } from './radio-problem.ts';
import { RadioSender } from './radio-sender.svelte.ts';
import { loadRadioTexts, saveRadioText } from './radio-text-store.ts';
import { MAX_RADIO_TEXTS, type StoredRadioText } from './radio-texts.ts';
import { Relinker, type LinkAttempt } from './relinker.ts';

/** What the radio needs from the active group's feed. */
export type RadioFeed = Pick<
  GroupFeed,
  'groupId' | 'attachRadio' | 'receiveFromRadio' | 'radioSent' | 'radioChannel'
>;

/** How often the scheduler is asked for the next packet, and frames not yet stored retried. */
const PUMP_MS = 1000;
/** Frames heard but not stored yet, at most: storage that keeps failing cannot fill memory. */
const MAX_UNSTORED = 200;
/** Times a frame is tried before it is given up: one that cannot be stored at all must not loop. */
const STORE_ATTEMPTS = 5;

/** An event heard by radio, opened, with the secret of the channel it came on. */
interface Unstored {
  readonly secret: Uint8Array;
  readonly event: Uint8Array;
  readonly attempts: number;
}

export class RadioSession {
  state: RadioLinkState = $state('disconnected');
  name: string | null = $state(null);
  /** The kind of the radio picked last, once one is. */
  family: RadioFamily | null = $state(null);
  /** True once the group's channel is configured: events flow both ways. */
  linked = $state(false);
  /** True while the link to a radio that was in use is lost and being tried again. */
  reconnecting = $state(false);
  problem: RadioProblem | null = $state(null);
  /** Signal-to-noise ratio of the last packet received, in dB. */
  lastSnr: number | null = $state(null);
  /** Text messages of other apps on the radio network, oldest first, the newest `MAX_RADIO_TEXTS`. */
  texts: readonly StoredRadioText[] = $state.raw([]);

  /** Asks the user to pick a radio and makes the link to it. */
  readonly #makeLink: () => Promise<RadioLink>;
  /** The link to the radio picked last; a new one is made for each radio picked. */
  #link: RadioLink | null = null;
  /** Stops following the link, once it is replaced. */
  #unfollow: (() => void)[] = [];
  /** True while the user picks a radio and its link is made. */
  #picking = false;
  readonly #claim: () => Promise<RadioRelease | null>;
  /** Lets other windows use the radio: held from connecting until the link is disconnected. */
  #release: RadioRelease | null = null;
  readonly #relinker = new Relinker(() => this.#linkFeed());
  #feed: RadioFeed | null = null;
  #db: AppDb | null = null;
  #pump: ReturnType<typeof setInterval> | null = null;
  /** Events whose storing failed, tried again on the next pump: none is lost to a busy disk. */
  #unstored: Unstored[] = [];
  readonly #frames = new RadioFrames();
  readonly #sender: RadioSender;
  #sosListeners: readonly ((call: SosElsewhere) => void)[] = [];

  constructor(
    makeLink: () => Promise<RadioLink> = pickedRadioLink,
    random = Math.random,
    claim = claimRadio,
  ) {
    this.#makeLink = makeLink;
    this.#claim = claim;
    this.#sender = new RadioSender({
      link: () => this.#link,
      feed: () => this.#feed,
      db: () => this.#db,
      frames: this.#frames,
      random,
    });
  }

  /** Share of the legal airtime (10 % of an hour) used in the last hour, 0 to 1. */
  get airtimeUsed(): number {
    return this.#sender.airtimeUsed;
  }

  /** Keeps this session in step with what `link` says, and stops following the previous one. */
  #follow(link: RadioLink): RadioLink {
    for (const stop of this.#unfollow) stop();
    this.#link = link;
    this.family = link.family;
    this.#unfollow = [
      link.onStateChange((state) => {
        const was = this.state;
        this.state = state;
        this.name = link.name;
        if (state !== 'ready') this.#unlink();
        if (state === 'disconnected') this.#letRadioGo();
        // Only a radio that was ready connects again by itself; the user's first try does not.
        this.reconnecting = state === 'connecting' && was === 'ready';
        // Linked each time it is ready: after a drop, and after a failed link made it drop.
        if (state === 'ready') void this.#relinker.link();
      }),
      link.onReceive(({ bytes, snr, secret }) => {
        // A frame that does not open was not sealed by the group: forged, changed on the way or
        // sent by an earlier version. It is dropped as if never heard.
        const event = this.#frames.open(secret, bytes);
        if (event === null) return;
        this.lastSnr = snr;
        const feed = this.#feed;
        if (feed === null || !bytesEqual(secret, feed.radioChannel.secret)) {
          this.#heardElsewhere(secret, event);
        }
        void this.#store({ secret, event, attempts: 0 });
      }),
      link.onText((text) => {
        const stored = { ...text, receivedAt: Date.now() };
        this.texts = [...this.texts, stored].slice(-MAX_RADIO_TEXTS);
        if (this.#db === null) return;
        saveRadioText(this.#db, stored).catch((error: unknown) => {
          console.warn('Keeping a radio text failed', error);
          storageRefusals.note(error);
        });
      }),
    ];
    return link;
  }

  /** Where heard text messages of other apps and other groups' events are kept. */
  async useStorage(db: AppDb): Promise<void> {
    this.#db = db;
    this.texts = [...(await loadRadioTexts(db)), ...this.texts].slice(-MAX_RADIO_TEXTS);
  }

  /** Tells `listener` of each SOS call or cancellation heard for a group that is not open. */
  onSosElsewhere(listener: (call: SosElsewhere) => void): () => void {
    this.#sosListeners = [...this.#sosListeners, listener];
    return () => {
      this.#sosListeners = this.#sosListeners.filter((other) => other !== listener);
    };
  }

  /**
   * Asks the user to pick a radio, connects and links it to the active group. While a radio is
   * connected or being picked, there is nothing to do: it must be disconnected first. While
   * another window of the app drives a radio, this one does not (radio-lock.ts).
   */
  async connect(): Promise<void> {
    if (this.#picking || (this.#link !== null && this.#link.state !== 'disconnected')) return;
    this.problem = null;
    this.#picking = true;
    try {
      this.#release ??= await this.#claim();
      if (this.#release === null) {
        this.problem = 'other-window';
        return;
      }
      // The budget is the radio's: what this or another window spent in the last hour counts.
      await this.#sender.restoreAirtime();
      await this.#follow(await this.#makeLink()).connect();
    } catch (error) {
      // No radio was picked, or it did not open: other windows may have it.
      if (this.#link === null || this.#link.state === 'disconnected') this.#letRadioGo();
      // Closing the browser's picker is not a problem worth reporting.
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        console.warn('Radio connection failed', error);
        this.problem = problemOf(error);
      }
      return;
    } finally {
      this.#picking = false;
    }
    // The radio, once ready, links the group by itself (`#follow`).
    await this.#relinker.settled();
  }

  async disconnect(): Promise<void> {
    await this.#link?.disconnect();
  }

  /**
   * Follows the active group: its channel goes into the radio and its events through it. What
   * was queued stays queued unless the group changes, as for a new alias or role; even then, an
   * own SOS still open keeps repeating on its group's channel.
   */
  async useFeed(feed: RadioFeed | null): Promise<void> {
    this.#unlink();
    if (feed?.groupId !== this.#feed?.groupId) this.#sender.changeGroup();
    this.#feed = feed;
    await this.#relinker.link();
  }

  /**
   * Clears a group's channel from the radio once the group is left, now if a radio is linked,
   * otherwise the next time one is (left-channels.ts). Its own SOS calls stop repeating.
   */
  async forgetGroup(secret: Uint8Array): Promise<void> {
    this.#sender.forget(secret);
    const left = groupId(secret);
    const link = this.#link?.state === 'ready' ? this.#link : null;
    if (this.#db === null) {
      await link?.forgetChannels((held) => groupId(held) === left);
      return;
    }
    await noteLeftChannel(this.#db, left);
    if (link !== null) await freeLeftChannels(this.#db, link);
  }

  /** Gives the radio the active group's channel and the group the radio; see relinker.ts. */
  async #linkFeed(): Promise<LinkAttempt> {
    const feed = this.#feed;
    const link = this.#link;
    if (feed === null || link?.state !== 'ready') return 'idle';
    const { name, secret } = feed.radioChannel;
    try {
      if (this.#db !== null) await freeLeftChannels(this.#db, link);
      await link.configureGroupChannel(name, secret);
    } catch (error) {
      this.problem = problemOf(error);
      // A radio with every channel in use stays so until one is freed in its own app.
      return this.problem === 'no-free-channel' ? 'idle' : 'failed';
    }
    // The active group or the radio changed meanwhile: what changed links anew.
    if (this.#feed !== feed || this.#link !== link || this.state !== 'ready') return 'idle';
    this.problem = null;
    this.linked = true;
    this.#pump ??= setInterval(() => void this.#tick(), PUMP_MS);
    try {
      await feed.attachRadio(this.#sender.sink);
      return 'linked';
    } catch (error) {
      console.warn('Giving the group the radio failed', error);
      return 'failed';
    }
  }

  #letRadioGo(): void {
    this.#release?.();
    this.#release = null;
  }

  #unlink(): void {
    void this.#feed?.attachRadio(null);
    this.linked = false;
    if (this.#pump !== null) clearInterval(this.#pump);
    this.#pump = null;
  }

  /**
   * An event heard on the channel of a group that is not open: an answer ends an own SOS that
   * may still repeat there, and an SOS or its cancellation is told, for the alarm.
   */
  #heardElsewhere(secret: Uint8Array, bytes: Uint8Array): void {
    const event = sosNewsIn(bytes);
    if (event === null) return;
    if (event.type !== 'sos') this.#sender.observe(event);
    if (event.type === 'ack') return;
    const call: SosElsewhere = { groupId: groupId(secret), event };
    for (const listener of this.#sosListeners) listener(call);
  }

  /**
   * An event heard on a group's channel: the active group's goes to its feed; another group's,
   * one this device belongs to and whose channel the radio still holds, goes to that group's log
   * for when it is opened.
   */
  async #store({ secret, event, attempts }: Unstored): Promise<void> {
    try {
      const feed = this.#feed;
      if (feed !== null && bytesEqual(secret, feed.radioChannel.secret)) {
        await feed.receiveFromRadio(event);
        return;
      }
      const db = this.#db;
      const group = db === null ? undefined : await getGroup(db, groupId(secret));
      if (db === null || group === undefined) return;
      await receiveEvents(db, group.id, [event], { forward: group.server !== null });
    } catch (error) {
      console.warn('Storing a radio frame failed', error);
      storageRefusals.note(error);
      if (attempts + 1 < STORE_ATTEMPTS) {
        this.#unstored = [...this.#unstored, { secret, event, attempts: attempts + 1 }].slice(
          -MAX_UNSTORED,
        );
      }
    }
  }

  async #tick(): Promise<void> {
    const unstored = this.#unstored;
    this.#unstored = [];
    for (const item of unstored) await this.#store(item);
    if (this.linked) await this.#sender.sendNext();
  }
}

/** This device's LoRa radio, linked or not (ADR-0048). */
export const radio = new RadioSession();
