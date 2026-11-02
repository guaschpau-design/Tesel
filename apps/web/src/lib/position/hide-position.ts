// Taking this device's position off the others' maps, and making sure it went: before leaving a
// group, once left the device could no longer tell it; and, when the user hides their position,
// in their other groups too, which would otherwise go on showing the last one they saw.

import { eventRefKey } from '@tesel/protocol';

import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import type { AppDb } from '../storage/app-db.ts';
import { GroupFeed } from '../sync/group-feed.svelte.ts';

/** How long hiding waits for the group to be told, before going on anyway. */
const WAIT_MS = 5000;
const POLL_MS = 200;

/** Hides this device's position from the group, if it sees one, and waits a moment until sent. */
export async function hidePositionAndWait(feed: GroupFeed, waitMs = WAIT_MS): Promise<void> {
  if (!feed.showsOwnPosition) return;
  try {
    const key = eventRefKey(await feed.hidePosition());
    const until = Date.now() + waitMs;
    while (feed.undelivered.has(key) && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  } catch (error) {
    // What follows goes ahead: the others then see the position grow old.
    console.warn('Hiding the position failed', error);
  }
}

/**
 * Hides this device's position in each group but the active one, opening each for the moment it
 * takes. A group whose server cannot be reached learns it the next time the group is used.
 */
export async function hideInOtherGroups(
  db: AppDb,
  groups: readonly StoredGroup[],
  identity: LocalIdentity,
  activeId: string | undefined,
): Promise<void> {
  for (const group of groups) {
    if (group.id === activeId) continue;
    const feed = await GroupFeed.open(db, group, identity);
    try {
      await hidePositionAndWait(feed);
    } finally {
      feed.close();
    }
  }
}
