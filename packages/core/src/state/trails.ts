// Where each member has been: their recent positions in order, for drawing their trail.
//
// A POSITION_HIDDEN ends a trail: positions up to it are dropped, so a member who hides is not
// drawn where they went before either (ARCHITECTURE.md §3.2, position privacy). Each trail keeps
// only its newest TRAIL_POINTS positions; which ones those are does not depend on the order in
// which events arrive, so every device draws the same trail.

import type { NodeId, PositionEvent, PositionHiddenEvent } from '@tesel/protocol';

import { insertAllOrdered, insertOrdered } from '../collections.ts';
import { compareEvents, newerOf } from '../ordering.ts';
import { defineSlice } from './slice.ts';

/** Positions kept per member: six hours at one a minute, or less when moving fast. */
export const TRAIL_POINTS = 360;

export interface Trail {
  /** Oldest first. */
  readonly points: readonly PositionEvent[];
  /** The latest time this member stopped sharing; the trail starts after it. */
  readonly hidden: PositionHiddenEvent | null;
}

type Trails = ReadonlyMap<NodeId, Trail>;

const EMPTY_TRAIL: Trail = { points: [], hidden: null };

export const trails = defineSlice({
  handles: ['position', 'position-hidden'],
  empty: new Map() as Trails,
  apply: (state, event) => {
    const trail = state.get(event.origin) ?? EMPTY_TRAIL;
    const next = event.type === 'position' ? withPosition(trail, event) : withHidden(trail, event);
    return next === trail ? state : new Map(state).set(event.origin, next);
  },
  // Opening a group of hours of positions copies the map of trails once, not once per position,
  // and each trail takes its member's positions at once.
  applyAll: (state, events) => {
    const byMember = new Map<NodeId, (PositionEvent | PositionHiddenEvent)[]>();
    for (const event of events) {
      const share = byMember.get(event.origin);
      if (share) share.push(event);
      else byMember.set(event.origin, [event]);
    }
    let next: Map<NodeId, Trail> | null = null;
    for (const [origin, share] of byMember) {
      const trail = state.get(origin) ?? EMPTY_TRAIL;
      const updated = withAll(trail, share);
      if (updated === trail) continue;
      next ??= new Map(state);
      next.set(origin, updated);
    }
    return next ?? state;
  },
});

/**
 * Whether a member's trail has outlived one of their positions: the position is not newer than
 * their last hiding, or the trail is full and the position is older than all of it. Later events
 * only move a trail forward, so no state that holds this trail's events can show that position
 * again, and a device need not keep it (ADR-0055).
 */
export function hasOutlived(trails: Trails, position: PositionEvent): boolean {
  const trail = trails.get(position.origin);
  if (trail === undefined) return false;
  if (trail.hidden !== null && compareEvents(position, trail.hidden) <= 0) return true;
  const oldest = trail.points[0];
  return (
    trail.points.length >= TRAIL_POINTS &&
    oldest !== undefined &&
    compareEvents(position, oldest) < 0
  );
}

/**
 * The positions that `after` has outlived among those that `before` showed in its trails and those
 * just `added`: what a device can forget once it has applied `added` (ADR-0055).
 */
export function outlivedPositions(
  before: Trails,
  after: Trails,
  added: Iterable<PositionEvent>,
): PositionEvent[] {
  const outlived: PositionEvent[] = [];
  for (const [origin, trail] of before) {
    if (after.get(origin) === trail) continue;
    outlived.push(...trail.points.filter((point) => hasOutlived(after, point)));
  }
  for (const position of added) {
    if (hasOutlived(after, position)) outlived.push(position);
  }
  return outlived;
}

function withPosition(trail: Trail, event: PositionEvent): Trail {
  if (trail.hidden !== null && compareEvents(event, trail.hidden) <= 0) return trail;
  const inserted = insertOrdered(trail.points, event);
  if (inserted === trail.points) return trail;
  if (inserted.length <= TRAIL_POINTS) return { ...trail, points: inserted };
  // Over the limit the oldest goes; if that is the new one, nothing changes.
  return inserted[0] === event ? trail : { ...trail, points: inserted.slice(1) };
}

/**
 * A trail after several events of its member at once, as applying them one by one leaves it: the
 * newest hiding ends it, and of the positions after it the newest `TRAIL_POINTS` stay, which is
 * the same whatever order they come in.
 */
function withAll(trail: Trail, events: readonly (PositionEvent | PositionHiddenEvent)[]): Trail {
  let { hidden } = trail;
  for (const event of events) {
    if (event.type === 'position-hidden') hidden = hidden === null ? event : newerOf(hidden, event);
  }
  const after = (point: PositionEvent) => hidden === null || compareEvents(point, hidden) > 0;
  const positions = events.filter(
    (event): event is PositionEvent => event.type === 'position' && after(event),
  );
  const kept = hidden === trail.hidden ? trail.points : trail.points.filter(after);
  const all = insertAllOrdered(kept, positions);
  const points = all.length > TRAIL_POINTS ? all.slice(-TRAIL_POINTS) : all;
  if (hidden === trail.hidden && sameEvents(points, trail.points)) return trail;
  return { points, hidden };
}

function sameEvents(a: readonly PositionEvent[], b: readonly PositionEvent[]): boolean {
  return a === b || (a.length === b.length && a.every((event, index) => event === b[index]));
}

function withHidden(trail: Trail, event: PositionHiddenEvent): Trail {
  const hidden = trail.hidden === null ? event : newerOf(trail.hidden, event);
  if (hidden === trail.hidden) return trail;
  const points = trail.points.filter((point) => compareEvents(point, hidden) > 0);
  return { points, hidden };
}
