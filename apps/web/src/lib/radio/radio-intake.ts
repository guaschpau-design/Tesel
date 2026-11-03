// Where an event heard by radio is stored (ADR-0043): the active group's goes to its feed; another
// group's, one this device belongs to and whose channel the radio still holds, goes to that group's
// log for when it is opened. One whose storing fails is tried again a few times, never without
// bound: none is lost to a busy disk, and one that cannot be stored at all does not loop.

import { bytesEqual } from '@tesel/protocol';

import { receiveEvents } from '../events/event-log.ts';
import { groupId } from '../groups/group.ts';
import { getGroup } from '../groups/group-store.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';

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

/** What storing needs of the active group's feed. */
type StoringFeed = Pick<GroupFeed, 'radioChannel' | 'receiveFromRadio'>;

/** Where the intake finds the active group's feed and the database, as they are now. */
interface Storing {
  readonly feed: () => StoringFeed | null;
  readonly db: () => AppDb | null;
}

export class RadioIntake {
  readonly #storing: Storing;
  /** Events whose storing failed, tried again by `retry`. */
  #unstored: Unstored[] = [];

  constructor(storing: Storing) {
    this.#storing = storing;
  }

  /** Stores an event heard on the channel of the group of `secret`. */
  take(secret: Uint8Array, event: Uint8Array): Promise<void> {
    return this.#store({ secret, event, attempts: 0 });
  }

  /** Tries again to store what could not be stored before. */
  async retry(): Promise<void> {
    const unstored = this.#unstored;
    this.#unstored = [];
    for (const item of unstored) await this.#store(item);
  }

  async #store({ secret, event, attempts }: Unstored): Promise<void> {
    try {
      const feed = this.#storing.feed();
      if (feed !== null && bytesEqual(secret, feed.radioChannel.secret)) {
        await feed.receiveFromRadio(event);
        return;
      }
      const db = this.#storing.db();
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
}
