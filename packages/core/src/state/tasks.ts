// The team's tasks: the latest TASK of each, by the reference of the event that created it. Last
// writer wins, like map objects (§3.11, ADR-0025).

import { eventRefKey, type TaskEvent } from '@tesel/protocol';

import { keepNewest, keepNewestAll } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const tasks = defineSlice({
  handles: ['task'],
  empty: new Map() as ReadonlyMap<string, TaskEvent>,
  apply: (state, event) => keepNewest(state, eventRefKey(event.task), event),
  applyAll: (state, events) => keepNewestAll(state, events, (event) => eventRefKey(event.task)),
});
