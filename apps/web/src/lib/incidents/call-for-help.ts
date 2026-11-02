// Calling for help (protocol §3.8), the same way whoever calls: the SOS dialog or the safety
// check-in. A call sent with no place is followed by this device's position as soon as the GPS
// has it, while the call is open and for a while at most.

import { eventRefKey, type EventRef, type LatLon, type SosKind } from '@tesel/protocol';

import { deviceLocation } from '../position/device-location.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';

/** How long the GPS is kept on for a call made without a place; past that it is let go. */
const FOLLOW_MS = 15 * 60_000;

/** Calls for help from `place`, or with no place if the device has none yet. */
export async function callForHelp(
  feed: GroupFeed,
  kind: SosKind,
  place: { readonly at: LatLon; readonly accuracy: number | null } | null,
  text: string,
): Promise<void> {
  const call = await feed.sendSos(kind, place?.at ?? null, place?.accuracy ?? null, text);
  if (place === null) followWithPosition(feed, call);
}

/**
 * Shares the device's first fix from now, which places a call sent without one; nothing once the
 * call is cancelled, and the GPS is let go after FOLLOW_MS without a fix.
 */
function followWithPosition(feed: GroupFeed, call: EventRef): void {
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    // Possibly called while `use` is still running, before `release` is assigned.
    queueMicrotask(() => {
      release();
    });
  };
  const timer = setTimeout(finish, FOLLOW_MS);
  const release = deviceLocation.use((fix) => {
    if (done) return;
    finish();
    if (feed.state.sosCancels.has(eventRefKey(call))) return;
    feed.sharePosition(fix).catch((error: unknown) => {
      console.warn('The position after a call for help could not be shared', error);
    });
  });
}
