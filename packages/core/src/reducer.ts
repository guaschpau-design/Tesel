// The current picture of a group, derived from its events (ARCHITECTURE.md §3.4, ADR-0003).
//
// The state is composed of slices, one per domain, in ./state/. `reduce` is idempotent and
// order-independent: applying the same events in any order, any number of times, gives the same
// state. Events arrive late, twice or out of order through several transports, and this property
// is what makes that harmless.

import type { EventType, PositionEvent, TeselEvent } from '@tesel/protocol';

import { acks } from './state/acks.ts';
import { checkIn } from './state/check-in.ts';
import { journal } from './state/journal.ts';
import { members, memberStates } from './state/members.ts';
import { alerts, chat, reports } from './state/messages.ts';
import { objects } from './state/objects.ts';
import { positions } from './state/positions.ts';
import { rollCall } from './state/roll-call.ts';
import type { Slice } from './state/slice.ts';
import { sos, sosCancels } from './state/sos.ts';
import { tasks } from './state/tasks.ts';
import { teams } from './state/teams.ts';
import { hasOutlived, outlivedPositions, trails } from './state/trails.ts';
import { zoneCrossings } from './state/zone-crossings.ts';

export type { ObjectRecord } from './state/objects.ts';
export type { JournalEvent } from './state/journal.ts';
export type { Trail } from './state/trails.ts';

/** Every slice of the group state, by its name in the state. */
const SLICES = {
  members,
  memberStates,
  positions,
  trails,
  chat,
  objects,
  sos,
  sosCancels,
  alerts,
  reports,
  acks,
  tasks,
  teams,
  rollCall,
  checkIn,
  zoneCrossings,
  journal,
};

type SliceName = keyof typeof SLICES;

export type GroupState = { readonly [K in SliceName]: (typeof SLICES)[K]['empty'] };

const SLICE_NAMES = Object.keys(SLICES) as SliceName[];

export const EMPTY_STATE: GroupState = Object.fromEntries(
  SLICE_NAMES.map((name) => [name, SLICES[name].empty]),
) as GroupState;

/** Which slices read each event type. Types no slice reads (or unknown ones) change nothing. */
const READERS: ReadonlyMap<EventType, readonly SliceName[]> = (() => {
  const readers = new Map<EventType, SliceName[]>();
  for (const name of SLICE_NAMES) {
    for (const type of SLICES[name].handles) {
      readers.set(type, [...(readers.get(type) ?? []), name]);
    }
  }
  return readers;
})();

/** Event types some slice reads, for the test that keeps every known type covered. */
export const HANDLED_TYPES: ReadonlySet<EventType> = new Set(READERS.keys());

/** The state after one more event. Returns `state` itself when nothing changes. */
export function reduce(state: GroupState, event: TeselEvent): GroupState {
  let next = state;
  for (const name of READERS.get(event.type) ?? []) {
    const value = applySlice(name, next[name], event);
    if (value !== next[name]) next = { ...next, [name]: value };
  }
  return next;
}

/**
 * The state after several more events, in any order: what a device does with a batch. Each slice
 * takes its share of the batch at once (`applyAll`), which is what the slices being independent
 * and order-independent allows, and gives the same state as `reduce` event by event.
 */
export function reduceAll(state: GroupState, events: Iterable<TeselEvent>): GroupState {
  const shares = new Map<SliceName, TeselEvent[]>();
  for (const event of events) {
    for (const name of READERS.get(event.type) ?? []) {
      const share = shares.get(name);
      if (share) share.push(event);
      else shares.set(name, [event]);
    }
  }
  let next = state;
  for (const [name, share] of shares) {
    const value = applySliceAll(name, next[name], share);
    if (value !== next[name]) next = { ...next, [name]: value };
  }
  return next;
}

/** The state of a set of events, in any order. */
export function stateOf(events: Iterable<TeselEvent>): GroupState {
  return reduceAll(EMPTY_STATE, events);
}

/**
 * Whether the state can no longer use `event`: a position its member's trail has outlived
 * (state/trails.ts). Applying it changes nothing, now or after any later event, so a device may
 * drop it as if it already had it (ADR-0055).
 */
export function isOutlived(state: GroupState, event: TeselEvent): boolean {
  return event.type === 'position' && hasOutlived(state.trails, event);
}

/**
 * The events a device can forget once `added` has taken the state from `before` to `after`: those
 * the new state has outlived, among the ones `before` still used and the ones `added`. The state of
 * the events kept is the state of all of them, whatever arrives later (ADR-0055).
 */
export function outlivedEvents(
  before: GroupState,
  after: GroupState,
  added: readonly TeselEvent[],
): PositionEvent[] {
  const positions = added.filter((event): event is PositionEvent => event.type === 'position');
  return outlivedPositions(before.trails, after.trails, positions);
}

// The one place where a slice is widened to any event and any state. It is safe: READERS only
// routes to a slice the event types it declared, and each state field holds that slice's own
// state. TypeScript cannot follow that correlation through a union of slice names.
function applySlice(name: SliceName, value: unknown, event: TeselEvent): unknown {
  const slice = SLICES[name] as unknown as Slice<unknown, EventType>;
  return slice.apply(value, event);
}

function applySliceAll(name: SliceName, value: unknown, events: readonly TeselEvent[]): unknown {
  const slice = SLICES[name] as unknown as Slice<unknown, EventType>;
  if (slice.applyAll) return slice.applyAll(value, events);
  return events.reduce((current, event) => slice.apply(current, event), value);
}
