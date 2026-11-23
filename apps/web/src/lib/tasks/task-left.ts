// How much a member has left to the place of a task of theirs (ADR-0166), reckoned on any device
// from the positions the group has of them:
// - to a point, or to the edge of an area, the straight way from their last position;
// - along a way, a route or the lanes of a strip, the rest of it, from where their positions since
//   the task was handed to them have got them, leg by leg as guidance follows a route.

import {
  distanceMeters,
  eastNorthMeters,
  nearestOnSegment,
  offsetMeters,
  pathMeters,
  type JournalEvent,
} from '@tesel/core';
import {
  eventRefKey,
  type LatLon,
  type Place,
  type PositionEvent,
  type ShapeGeometry,
} from '@tesel/protocol';

import { insideRing, toPosition } from '../map/geometry.ts';
import { legBetween } from '../navigation/leg.ts';
import { RouteTracker, type RouteProgress } from '../navigation/route.ts';
import type { TaskGoal } from './task-reach.ts';

/** What is left to the place of a task. */
export interface WayLeft {
  /** Metres left; 0 once there. */
  readonly metres: number;
  /**
   * The way left, from the member's last position: the straight way to a point or an area, the
   * rest of a way along it. Only that position once there.
   */
  readonly way: readonly LatLon[];
  /** Whether it is the straight way, not along a way of the map. */
  readonly straight: boolean;
}

/**
 * What a member has left to `goal`, from their positions since the task was handed to them,
 * oldest first, the last of them where they are now; null without any.
 */
export function wayLeft(goal: TaskGoal, positions: readonly PositionEvent[]): WayLeft | null {
  const last = positions.at(-1);
  if (last === undefined) return null;
  const here = pointOf(last);
  const there: WayLeft = { metres: 0, way: [here], straight: goal.kind !== 'way' };
  switch (goal.kind) {
    case 'point': {
      if (legBetween(here, goal.at, last.accuracy).arrived) return there;
      return straightTo(here, goal.at);
    }
    case 'area': {
      const edge = edgeOutside(goal.geometry, here);
      return edge === null ? there : straightTo(here, edge);
    }
    case 'way': {
      const progress = followed(goal.points, positions, last);
      switch (progress.stage) {
        case 'arrived':
          return there;
        case 'to-start':
          return along([here, ...goal.points]);
        case 'on-route':
        case 'off-route':
          return along([here, progress.to, ...goal.points.slice(progress.next + 1)]);
      }
    }
  }
}

/**
 * Since when a task has been for whom it is now, at the place it is now: the time of the earliest
 * of its latest events that all say so; null for a task the journal does not have.
 */
export function handedAt(journal: readonly JournalEvent[], taskKey: string): number | null {
  let current: Extract<JournalEvent, { type: 'task' }> | null = null;
  let since: number | null = null;
  // In (time, origin, seq) order: the last of the task's events is how it is now.
  for (let index = journal.length - 1; index >= 0; index--) {
    const event = journal[index];
    if (event?.type !== 'task' || eventRefKey(event.task) !== taskKey) continue;
    current ??= event;
    if (event.assignee !== current.assignee || !samePlace(event.place, current.place)) break;
    since = event.time;
  }
  return since;
}

/**
 * The positions of a trail, oldest first, that tell how far a member is with a task handed to
 * them at `since`: where they were then, the last position before it, and every one after.
 */
export function positionsSince(
  trail: readonly PositionEvent[],
  since: number,
): readonly PositionEvent[] {
  const after = trail.findIndex((position) => position.time >= since);
  if (after === -1) return trail.slice(-1);
  return trail.slice(Math.max(0, after - 1));
}

function straightTo(here: LatLon, to: LatLon): WayLeft {
  return { metres: distanceMeters(here, to), way: [here, to], straight: true };
}

function along(way: readonly LatLon[]): WayLeft {
  return { metres: pathMeters(way), way, straight: false };
}

/** How far along a way positions have got, the last of them where the member is now. */
function followed(
  points: readonly LatLon[],
  positions: readonly PositionEvent[],
  last: PositionEvent,
): RouteProgress {
  const tracker = new RouteTracker(points, 'anywhere');
  for (const position of positions.slice(0, -1))
    tracker.update(pointOf(position), position.accuracy);
  return tracker.update(pointOf(last), last.accuracy);
}

function pointOf(position: PositionEvent): LatLon {
  return { lat: position.lat, lon: position.lon };
}

/** The nearest point of an area's edge to `here`, if outside it; null inside. */
function edgeOutside(
  geometry: Exclude<ShapeGeometry, { kind: 'polyline' }>,
  here: LatLon,
): LatLon | null {
  if (geometry.kind === 'circle') {
    const { center, radius } = geometry;
    const distance = distanceMeters(center, here);
    if (distance <= radius) return null;
    const { east, north } = eastNorthMeters(center, here);
    const scale = radius / distance;
    return offsetMeters(center, north * scale, east * scale);
  }
  const { points } = geometry;
  if (insideRing(points.map(toPosition), here)) return null;
  let nearest: { readonly at: LatLon; readonly meters: number } | null = null;
  for (const [index, point] of points.entries()) {
    const edge = nearestOnSegment(here, point, points[(index + 1) % points.length] ?? point);
    if (nearest === null || edge.meters < nearest.meters) nearest = edge;
  }
  return nearest?.at ?? null;
}

function samePlace(a: Place | null, b: Place | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'point' && b.kind === 'point') {
    return a.at.lat === b.at.lat && a.at.lon === b.at.lon;
  }
  if (a.kind === 'object' && b.kind === 'object') {
    return eventRefKey(a.object) === eventRefKey(b.object);
  }
  return false;
}
