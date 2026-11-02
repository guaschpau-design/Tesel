// Leaving a group takes this device's position off the others' maps first: once left, the device
// could no longer tell them, and its last position would stay there.

import { eventRefKey } from '@tesel/protocol';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';

/** How long leaving waits for the group to be told, before going anyway. */
const WAIT_MS = 5000;
const POLL_MS = 200;

/** Hides this device's position from the group, if it sees one, and waits a moment until sent. */
export async function hideOnLeaving(feed: GroupFeed, waitMs = WAIT_MS): Promise<void> {
  if (!feed.showsOwnPosition) return;
  try {
    const key = eventRefKey(await feed.hidePosition());
    const until = Date.now() + waitMs;
    while (feed.undelivered.has(key) && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  } catch (error) {
    // Leaving goes ahead: the others then see the position grow old.
    console.warn('Hiding the position before leaving failed', error);
  }
}
