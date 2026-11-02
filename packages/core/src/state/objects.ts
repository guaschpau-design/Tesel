// What is drawn on the map: the latest event of each object, by the reference of the event that
// created it. Last writer wins, and deletions are kept so a late edit cannot revive an object
// (§3.10, ADR-0003).

import {
  eventRefKey,
  type MarkerEvent,
  type ObjectDeleteEvent,
  type ShapeEvent,
  type SweepEvent,
} from '@tesel/protocol';

import { keepNewest, keepNewestAll } from '../collections.ts';
import { defineSlice } from './slice.ts';

/** The latest event about a map object; OBJECT_DELETE means the object is gone. */
export type ObjectRecord = MarkerEvent | ShapeEvent | SweepEvent | ObjectDeleteEvent;

export const objects = defineSlice({
  handles: ['marker', 'shape', 'sweep', 'object-delete'],
  empty: new Map() as ReadonlyMap<string, ObjectRecord>,
  apply: (state, event) => keepNewest(state, eventRefKey(event.object), event),
  applyAll: (state, events) => keepNewestAll(state, events, (event) => eventRefKey(event.object)),
});
