// Calls for help: every SOS, and the first cancellation of each, which also says who cancelled it
// (§3.8). An SOS is active until it has a cancellation.

import { eventRefKey, type SosCancelEvent, type SosEvent } from '@tesel/protocol';

import { keepOldest, keepOldestAll } from '../collections.ts';
import { defineSlice } from './slice.ts';

/** Every SOS, by event reference key. */
export const sos = defineSlice({
  handles: ['sos'],
  empty: new Map() as ReadonlyMap<string, SosEvent>,
  apply: (state, event) => keepOldest(state, eventRefKey(event), event),
  applyAll: (state, events) => keepOldestAll(state, events, eventRefKey),
});

/** The first cancellation of each SOS, by the SOS's reference key. */
export const sosCancels = defineSlice({
  handles: ['sos-cancel'],
  empty: new Map() as ReadonlyMap<string, SosCancelEvent>,
  apply: (state, event) => keepOldest(state, eventRefKey(event.sos), event),
  applyAll: (state, events) => keepOldestAll(state, events, (event) => eventRefKey(event.sos)),
});

/** The calls for help not cancelled yet, with their reference keys. */
export function* openSosCalls(state: {
  readonly sos: ReadonlyMap<string, SosEvent>;
  readonly sosCancels: ReadonlyMap<string, SosCancelEvent>;
}): Generator<[key: string, call: SosEvent]> {
  for (const [key, call] of state.sos) {
    if (!state.sosCancels.has(key)) yield [key, call];
  }
}
