// Where members' devices saw them cross the edge of an area of the group (§3.18): into a danger
// area, out of the area of their task. Kept like reports, in (time, origin, seq) order; the newest
// of a member for an area is where the group last saw them.

import type { ZoneCrossingEvent } from '@tesel/protocol';

import { insertAllOrdered, insertOrdered } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const zoneCrossings = defineSlice({
  handles: ['zone-crossing'],
  empty: [] as readonly ZoneCrossingEvent[],
  apply: insertOrdered,
  applyAll: insertAllOrdered,
});
