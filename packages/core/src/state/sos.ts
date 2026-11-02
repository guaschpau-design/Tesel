// Calls for help: every SOS, and the first cancellation of each, which also says who cancelled it
// (§3.8). An SOS is active until it has a cancellation.

import { eventRefKey, type SosCancelEvent, type SosEvent } from '@tesel/protocol';

import { insertOrdered, keepOldest, keepOldestAll } from '../collections.ts';
import { rivalKey } from '../rivals.ts';
import { defineSlice } from './slice.ts';

type Calls = ReadonlyMap<string, readonly SosEvent[]>;

/**
 * Every SOS, by event reference key. A reference holds one call, or more if a member forged one
 * under another's `(origin, seq)`: every call is kept then, in `(time, origin, seq)` order, since
 * none can be told genuine (protocol §3.1, ADR-0103).
 */
export const sos = defineSlice({
  handles: ['sos'],
  empty: new Map() as Calls,
  apply: (state, event) => addCalls(state, [event]),
  applyAll: addCalls,
});

function addCalls(state: Calls, events: readonly SosEvent[]): Calls {
  let next: Map<string, readonly SosEvent[]> | null = null;
  for (const event of events) {
    const key = eventRefKey(event);
    const calls = (next ?? state).get(key) ?? [];
    const added = insertOrdered(calls, event);
    if (added !== calls) (next ??= new Map(state)).set(key, added);
  }
  return next ?? state;
}

/**
 * The first cancellation of each SOS, by the SOS's reference key: it cancels every call under that
 * reference.
 */
export const sosCancels = defineSlice({
  handles: ['sos-cancel'],
  empty: new Map() as ReadonlyMap<string, SosCancelEvent>,
  apply: (state, event) => keepOldest(state, eventRefKey(event.sos), event),
  applyAll: (state, events) => keepOldestAll(state, events, (event) => eventRefKey(event.sos)),
});

/**
 * The calls for help not cancelled yet, each with a key of its own (`rivalKey`): two calls under
 * one reference keep theirs whatever else arrives. Cancellations and acknowledgements point to the
 * call's reference key (`eventRefKey`).
 */
export function* openSosCalls(state: {
  readonly sos: Calls;
  readonly sosCancels: ReadonlyMap<string, SosCancelEvent>;
}): Generator<[key: string, call: SosEvent]> {
  for (const [reference, calls] of state.sos) {
    if (state.sosCancels.has(reference)) continue;
    for (const call of calls) yield [rivalKey(call), call];
  }
}
