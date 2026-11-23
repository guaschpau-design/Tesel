// Where members' devices saw them reach the place of a task of theirs (§3.19). Kept like zone
// crossings, in (time, origin, seq) order; a team's task is reached once, by whoever comes first.

import type { TaskReachedEvent } from '@tesel/protocol';

import { insertAllOrdered, insertOrdered } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const taskReaches = defineSlice({
  handles: ['task-reached'],
  empty: [] as readonly TaskReachedEvent[],
  apply: insertOrdered,
  applyAll: insertAllOrdered,
});
