// What reaches one group's log from outside, from its server, a radio or a file: stored, then given
// to the picture (group-sync.svelte.ts). Two things can stand in the way, and neither may keep an
// SOS from the screen (ADR-0103): a storage with no room, and events someone wrote under another
// member's name.

import type { NodeId } from '@tesel/protocol';
import { SvelteSet } from 'svelte/reactivity';

import {
  receiveEvents,
  storeHeld,
  type Received,
  type ReceivedBatch,
  type ReceiveOptions,
} from '../events/event-log.ts';
import { heldEvents } from '../events/held-events.ts';
import { skipSequence } from '../events/own-events.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';

/** How often what the log holds for lack of room is tried again (held-events.ts). */
const HELD_RETRY_MS = 10_000;

/** The picture events go to once the log has them. */
interface Picture {
  /** Adds events to the picture. */
  apply(batch: readonly Uint8Array[]): Promise<unknown>;
  /** Makes the picture again from the log, after events it was made with gave way to rivals. */
  reload(): Promise<void>;
}

export class GroupIntake {
  /**
   * Members someone else writes as, seen since the group opened: another event arrived under one
   * of their references, or, for this device, an event under its name took a number it had not
   * used yet.
   */
  readonly impersonated = new SvelteSet<NodeId>();

  readonly #db: AppDb;
  readonly #groupId: string;
  readonly #self: NodeId;
  readonly #picture: Picture;
  /** Until what the log holds for lack of room is tried again. */
  #heldRetry: ReturnType<typeof setTimeout> | null = null;
  #closed = false;

  constructor(db: AppDb, groupId: string, self: NodeId, picture: Picture) {
    this.#db = db;
    this.#groupId = groupId;
    this.#self = self;
    this.#picture = picture;
    if (this.held().length > 0) this.storeHeldLater();
  }

  close(): void {
    this.#closed = true;
    if (this.#heldRetry !== null) clearTimeout(this.#heldRetry);
  }

  /**
   * Stores a batch and gives the picture what it changes. If the batch cannot be stored, what may
   * save a life in it reaches the picture all the same, held by the log until there is room; the
   * user is told the storage is full and the failure is passed on.
   */
  async store(batch: readonly Uint8Array[], options: ReceiveOptions): Promise<Received[]> {
    let received: ReceivedBatch;
    try {
      received = await receiveEvents(this.#db, this.#groupId, batch, options);
    } catch (error) {
      storageRefusals.note(error);
      await this.#picture.apply(this.held());
      this.storeHeldLater();
      throw error;
    }
    if (received.displaced) await this.#picture.reload();
    else await this.#picture.apply(received.added.map(({ bytes }) => bytes));
    await this.#noteRivals(received);
    return received.added;
  }

  /** What the log holds in memory for lack of room. */
  held(): Uint8Array[] {
    return heldEvents(this.#db, this.#groupId).map(({ bytes }) => bytes);
  }

  /** Tries again later to store what the log holds for lack of room, until nothing is held. */
  storeHeldLater(): void {
    if (this.#heldRetry !== null || this.#closed) return;
    this.#heldRetry = setTimeout(() => {
      void storeHeld(this.#db, this.#groupId).then((done) => {
        this.#heldRetry = null;
        if (!done) this.storeHeldLater();
      });
    }, HELD_RETRY_MS);
  }

  /**
   * Notes who someone else writes as: the authors of events with rivals, and this device when an
   * event under its name takes a number it has not used yet. It skips that number, so that its own
   * next events, an SOS above all, do not meet a rival.
   */
  async #noteRivals({ added, rivalled }: ReceivedBatch): Promise<void> {
    for (const { origin } of rivalled) this.impersonated.add(origin);
    const own = added.filter(({ entry }) => entry.origin === this.#self);
    const last = Math.max(0, ...own.map(({ entry }) => entry.seq));
    if (last > 0 && (await skipSequence(this.#db, last))) this.impersonated.add(this.#self);
  }
}
