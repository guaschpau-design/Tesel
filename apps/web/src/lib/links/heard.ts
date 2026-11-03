// What this device has heard from each member, and through which channel: the time of the newest
// event of theirs that arrived by radio or through the group's server.
// It tells what reaches this device and how. By radio does not mean from the member's own radio:
// a bridge may have put their event on the air (ARCHITECTURE.md §4.3), and the radio cannot tell
// who transmitted. Duplicates count: an event already in the log that arrives again by radio
// still shows that the radio brings that member's news, as a frame played back does, at the
// event's own time, never a later one (ADR-0111).

import type { NodeId } from '@tesel/protocol';

/** How an event reaches this device. */
export type Channel = 'internet' | 'radio';

/** Per member and channel, the event time (seconds) of the newest event heard through it. */
export type Heard = ReadonlyMap<NodeId, Readonly<Partial<Record<Channel, number>>>>;

export const NOTHING_HEARD: Heard = new Map();

/** Records events heard together through one channel; the same map if nothing is newer. */
export function hear(
  heard: Heard,
  channel: Channel,
  events: Iterable<{ readonly origin: NodeId; readonly time: number }>,
): Heard {
  let next: Map<NodeId, Readonly<Partial<Record<Channel, number>>>> | null = null;
  for (const { origin, time } of events) {
    const known = (next ?? heard).get(origin);
    if ((known?.[channel] ?? -Infinity) >= time) continue;
    next ??= new Map(heard);
    next.set(origin, { ...known, [channel]: time });
  }
  return next ?? heard;
}
