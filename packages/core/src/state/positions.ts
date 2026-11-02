// Where each member is: their latest position report; POSITION_HIDDEN means "not sharing" (§3.4).

import type { NodeId, PositionEvent, PositionHiddenEvent } from '@tesel/protocol';

import { keepNewest, keepNewestAll } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const positions = defineSlice({
  handles: ['position', 'position-hidden'],
  empty: new Map() as ReadonlyMap<NodeId, PositionEvent | PositionHiddenEvent>,
  apply: (state, event) => keepNewest(state, event.origin, event),
  applyAll: (state, events) => keepNewestAll(state, events, (event) => event.origin),
});
