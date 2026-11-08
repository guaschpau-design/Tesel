// The record of the operation: every event except routine positions, in (time, origin, seq)
// order, so every device keeps the same diary. The other slices hold the current picture; this one
// keeps what happened on the way, such as an object's earlier versions or who joined when.

import { insertAllOrdered, insertOrdered } from '../collections.ts';
import { defineSlice, type EventOfType } from './slice.ts';

const JOURNAL_TYPES = [
  'member-info',
  'position-hidden',
  'chat',
  'marker',
  'shape',
  'object-delete',
  'sos',
  'sos-cancel',
  'alert',
  'ack',
  'task',
  'roll-call',
  'sweep',
  'member-state',
  'team',
  'report',
  'check-in-timer',
  'zone-crossing',
] as const;

export type JournalEvent = EventOfType<(typeof JOURNAL_TYPES)[number]>;

export const journal = defineSlice({
  handles: JOURNAL_TYPES,
  empty: [] as readonly JournalEvent[],
  apply: insertOrdered,
  applyAll: insertAllOrdered,
});
