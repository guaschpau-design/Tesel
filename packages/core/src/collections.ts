// Immutable, idempotent updates of the collections in the group state. Each returns the input
// collection itself when the event changes nothing, so callers can detect "no change" cheaply.

import type { TeselEvent } from '@tesel/protocol';

import { compareEvents, newerOf } from './ordering.ts';

/** Keeps, per key, the newest event by (time, origin, seq). */
export function keepNewest<K, T extends TeselEvent>(
  current: ReadonlyMap<K, T>,
  key: K,
  event: T,
): ReadonlyMap<K, T> {
  const known = current.get(key);
  if (known !== undefined && newerOf(known, event) === known) return current;
  return new Map(current).set(key, event);
}

/** Keeps, per key, the oldest event by (time, origin, seq). */
export function keepOldest<K, T extends TeselEvent>(
  current: ReadonlyMap<K, T>,
  key: K,
  event: T,
): ReadonlyMap<K, T> {
  const known = current.get(key);
  if (known !== undefined && compareEvents(known, event) <= 0) return current;
  return new Map(current).set(key, event);
}

/** Inserts keeping (time, origin, seq) order; an event already present changes nothing. */
export function insertOrdered<T extends TeselEvent>(list: readonly T[], event: T): readonly T[] {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = list[middle];
    if (item === undefined || compareEvents(item, event) >= 0) high = middle;
    else low = middle + 1;
  }
  const atPosition = list[low];
  if (atPosition?.origin === event.origin && atPosition.seq === event.seq) return list;
  return [...list.slice(0, low), event, ...list.slice(low)];
}

/** `keepNewest` for many events at once: the collection is copied once, if anything changes. */
export function keepNewestAll<K, T extends TeselEvent>(
  current: ReadonlyMap<K, T>,
  events: readonly T[],
  keyOf: (event: T) => K,
): ReadonlyMap<K, T> {
  return keepAll(current, events, keyOf, (known, event) => newerOf(known, event) !== known);
}

/** `keepOldest` for many events at once: the collection is copied once, if anything changes. */
export function keepOldestAll<K, T extends TeselEvent>(
  current: ReadonlyMap<K, T>,
  events: readonly T[],
  keyOf: (event: T) => K,
): ReadonlyMap<K, T> {
  return keepAll(current, events, keyOf, (known, event) => compareEvents(known, event) > 0);
}

function keepAll<K, T extends TeselEvent>(
  current: ReadonlyMap<K, T>,
  events: readonly T[],
  keyOf: (event: T) => K,
  replaces: (known: T, event: T) => boolean,
): ReadonlyMap<K, T> {
  let next: Map<K, T> | null = null;
  for (const event of events) {
    const key = keyOf(event);
    const known = (next ?? current).get(key);
    if (known !== undefined && !replaces(known, event)) continue;
    next ??= new Map(current);
    next.set(key, event);
  }
  return next ?? current;
}

/** `insertOrdered` for many events at once: one sort, instead of a copy per event. */
export function insertAllOrdered<T extends TeselEvent>(
  list: readonly T[],
  events: readonly T[],
): readonly T[] {
  const known = new Set(list.map(orderKey));
  const added = events.filter((event) => {
    const key = orderKey(event);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return added.length === 0 ? list : [...list, ...added].sort(compareEvents);
}

/** What `compareEvents` orders by: two events with the same key are the same place in a list. */
function orderKey(event: TeselEvent): string {
  return `${String(event.time)}|${event.origin}|${String(event.seq)}`;
}
