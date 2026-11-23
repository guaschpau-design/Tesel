// Reaching the place of a task (protocol §3.19, ADR-0166). Where a task is reached:
// - inside its area;
// - at its point;
// - at the end of its way, a route or the lanes of a strip.
// Which reaches the group has of a member or their team. And, on the member's own device, which of
// their tasks the fixes bear out they are at, by the rules a zone crossing is borne out by
// (objects/zone-watch.ts).

import { teamOf, type GroupState } from '@tesel/core';
import {
  eventRefKey,
  type LatLon,
  type NodeId,
  type Place,
  type ShapeGeometry,
  type TaskReachedEvent,
} from '@tesel/protocol';

import { legBetween } from '../navigation/leg.ts';
import { RouteTracker } from '../navigation/route.ts';
import { objectDestination } from '../navigation/target.ts';
import { BORNE_OUT_MS, POOR_FIX_M, sideOf, type ZoneFix } from '../objects/zone-watch.ts';
import { assignedTo } from './tasks.ts';

/**
 * Where a task is reached, by its place:
 * - a point or a marker, close to it;
 * - an area or a circle, inside it;
 * - a line of the map or a strip of a sweep, at the end of the way it leads along, as guidance
 *   follows it (navigation/target.ts).
 */
export type TaskGoal =
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'area'; readonly geometry: Exclude<ShapeGeometry, { kind: 'polyline' }> }
  | { readonly kind: 'way'; readonly points: readonly LatLon[] };

/** Where a task with this place is reached; null for none, or an object no longer on the map. */
export function taskGoal(place: Place | null, objects: GroupState['objects']): TaskGoal | null {
  if (place === null) return null;
  if (place.kind === 'point') return { kind: 'point', at: place.at };
  const record = objects.get(eventRefKey(place.object));
  if (record?.type === 'shape' && record.geometry.kind !== 'polyline') {
    return { kind: 'area', geometry: record.geometry };
  }
  const destination = objectDestination(record, objects);
  if (destination === null) return null;
  return destination.kind === 'point'
    ? { kind: 'point', at: destination.at }
    : { kind: 'way', points: destination.points };
}

/**
 * The first reach the group has of a task by `member` or someone in their team now: a team's task
 * is reached once, by whoever gets there first. Null if none of them has reached it.
 */
export function reachOf(
  state: Pick<GroupState, 'taskReaches' | 'teams'>,
  taskKey: string,
  member: NodeId,
): TaskReachedEvent | null {
  const team = teamOf(state.teams, member)?.team;
  // In (time, origin, seq) order: the first found is the first made.
  for (const reach of state.taskReaches) {
    if (eventRefKey(reach.task) !== taskKey) continue;
    const by = reach.origin;
    if (by === member || (team !== undefined && teamOf(state.teams, by)?.team === team)) {
      return reach;
    }
  }
  return null;
}

/**
 * Where the tasks `self` still has to reach are, by their key: those open or in progress for them
 * or their team, with a place, that neither they nor their team have reached yet.
 */
export function goalsToReach(state: GroupState, self: NodeId): ReadonlyMap<string, TaskGoal> {
  const goals = new Map<string, TaskGoal>();
  for (const [key, task] of assignedTo(state, self)) {
    if (reachOf(state, key, self) !== null) continue;
    const goal = taskGoal(task.place, state.objects);
    if (goal !== null) goals.set(key, goal);
  }
  return goals;
}

/** The tasks this member is at the place of, as two fixes bear it out, by their key. */
export class ReachWatch {
  /** The way of each task along one, and how far along it this member is. */
  readonly #ways = new Map<
    string,
    { readonly points: readonly LatLon[]; readonly tracker: RouteTracker }
  >();
  /** When the place of a task was first seen reached, waiting for a second fix to bear it out. */
  readonly #since = new Map<string, number>();
  readonly #there = new Set<string>();
  /** Tasks told of from here, so that each is told once while the group's state lacks it. */
  readonly #told = new Set<string>();

  /** The tasks this member is at the place of: a copy, which later fixes leave as it is. */
  reached(): ReadonlySet<string> {
    return new Set(this.#there);
  }

  /** Whether a task is yet to be told of from here; from now on it is not. */
  tellOnce(key: string): boolean {
    if (this.#told.has(key)) return false;
    this.#told.add(key);
    return true;
  }

  /**
   * Takes in a fix: whether it changed which tasks this member is at the place of. Tasks no longer
   * among `goals` are forgotten; a poor fix tells nothing.
   */
  see(goals: ReadonlyMap<string, TaskGoal>, fix: ZoneFix): boolean {
    let changed = false;
    for (const key of new Set([...this.#ways.keys(), ...this.#since.keys(), ...this.#there])) {
      if (goals.has(key)) continue;
      this.#ways.delete(key);
      this.#since.delete(key);
      changed = this.#there.delete(key) || changed;
    }
    if (fix.accuracy === null || fix.accuracy > POOR_FIX_M) return changed;
    for (const [key, goal] of goals) {
      const isAt = this.#isAt(key, goal, fix);
      // Too close to an area's edge to tell: as before.
      if (isAt === null) continue;
      if (!isAt) {
        this.#since.delete(key);
        changed = this.#there.delete(key) || changed;
        continue;
      }
      if (this.#there.has(key)) continue;
      const since = this.#since.get(key);
      if (since === undefined) {
        this.#since.set(key, fix.time);
      } else if (fix.time - since >= BORNE_OUT_MS) {
        this.#since.delete(key);
        this.#there.add(key);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Whether a fix is at the place of a task: for a way, at its end once walked to it. Null for
   * one too close to an area's edge to tell, as a crossing takes it (zone-watch.ts).
   */
  #isAt(key: string, goal: TaskGoal, fix: ZoneFix): boolean | null {
    switch (goal.kind) {
      case 'point':
        return legBetween(fix.at, goal.at, fix.accuracy).arrived;
      case 'area': {
        const side = sideOf(goal.geometry, fix);
        return side === null ? null : side === 'inside';
      }
      case 'way': {
        const end = goal.points.at(-1);
        const progress = this.#along(key, goal.points).update(fix.at, fix.accuracy);
        // At the end, not walked away from it since.
        return (
          progress.stage === 'arrived' &&
          end !== undefined &&
          legBetween(fix.at, end, fix.accuracy).arrived
        );
      }
    }
  }

  /** The tracker of a task's way, taken up again if the way has changed. */
  #along(key: string, points: readonly LatLon[]): RouteTracker {
    const known = this.#ways.get(key);
    if (known !== undefined && samePoints(known.points, points)) return known.tracker;
    const tracker = new RouteTracker(points, 'anywhere');
    this.#ways.set(key, { points, tracker });
    return tracker;
  }
}

/** The same points, one by one: a strip's lanes are worked out again with every change. */
function samePoints(a: readonly LatLon[], b: readonly LatLon[]): boolean {
  return (
    a.length === b.length &&
    a.every((point, index) => {
      const other = b[index];
      return other !== undefined && point.lat === other.lat && point.lon === other.lon;
    })
  );
}
