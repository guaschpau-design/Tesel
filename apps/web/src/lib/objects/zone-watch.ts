// Which side of the group's areas this member is on, borne out over two fixes, and the crossings
// the group should be told of (protocol §3.18, ADR-0122): a danger area entered, the area of a
// task of theirs left, and back. A fix that wanders across an edge changes nothing.

import { distanceMeters, nearestOnSegment, type GroupState } from '@tesel/core';
import {
  eventRefKey,
  ShapeStyleCode,
  type LatLon,
  type NodeId,
  type ObjectRef,
  type ShapeEvent,
  type ShapeGeometry,
  type ZoneCrossing,
  type ZoneCrossingEvent,
  type ZoneKind,
} from '@tesel/protocol';

import { insideRing, toPosition } from '../map/geometry.ts';
import { assignedTo } from '../tasks/tasks.ts';

/** Fixes less sure than this, in metres, are left out. */
const POOR_FIX_M = 30;
/** A fix closer to an edge than this, or than its accuracy, is on neither side. */
const EDGE_M = 10;
/** How long after the first fix on a new side the second must come, in milliseconds. */
const BORNE_OUT_MS = 10_000;
/** The least time between two crossings told of one area, in milliseconds. */
const RETELL_MS = 60_000;

export type Side = 'inside' | 'outside';

/** An area watched: a danger area, or the area of a task of this member or their team. */
export interface WatchedZone {
  /** The area's reference key. */
  readonly key: string;
  readonly ref: ObjectRef;
  readonly shape: ShapeEvent;
  readonly kind: Extract<ZoneKind, 'danger' | 'assigned'>;
}

export interface ZoneFix {
  readonly at: LatLon;
  readonly accuracy: number | null;
  /** Milliseconds since the epoch. */
  readonly time: number;
}

/**
 * The areas watched for `self`: the danger areas, and the areas of its pending tasks and its
 * team's, a sweep strip's being the area it sweeps. An area that is both is a danger area.
 */
export function watchedZones(state: GroupState, self: NodeId): WatchedZone[] {
  const zones = new Map<string, WatchedZone>();
  const add = (ref: ObjectRef, kind: WatchedZone['kind']): void => {
    const key = eventRefKey(ref);
    const record = state.objects.get(key);
    if (record?.type !== 'shape' || record.geometry.kind === 'polyline') return;
    if (zones.get(key)?.kind === 'danger') return;
    zones.set(key, { key, ref, shape: record, kind });
  };
  for (const task of assignedTo(state, self).values()) {
    if (task.place?.kind !== 'object') continue;
    const object = state.objects.get(eventRefKey(task.place.object));
    if (object?.type === 'sweep') add(object.area, 'assigned');
    else if (object?.type === 'shape') add(object.object, 'assigned');
  }
  for (const record of state.objects.values()) {
    if (record.type === 'shape' && record.style === ShapeStyleCode.DANGER) {
      add(record.object, 'danger');
    }
  }
  return [...zones.values()];
}

/** Which side of an area a fix is clearly on: none within its accuracy, or 10 m, of the edge. */
export function sideOf(
  geometry: ShapeGeometry,
  fix: Pick<ZoneFix, 'at' | 'accuracy'>,
): Side | null {
  const margin = Math.max(fix.accuracy ?? 0, EDGE_M);
  if (geometry.kind === 'circle') {
    const off = distanceMeters(geometry.center, fix.at) - geometry.radius;
    if (Math.abs(off) < margin) return null;
    return off < 0 ? 'inside' : 'outside';
  }
  const { points } = geometry;
  const edge = Math.min(
    ...points.map(
      (point, index) =>
        nearestOnSegment(fix.at, point, points[(index + 1) % points.length] ?? point).meters,
    ),
  );
  if (edge < margin) return null;
  return insideRing(points.map(toPosition), fix.at) ? 'inside' : 'outside';
}

/** A side borne out: which area, which side, and the side it was on before, if known. */
export interface SideChange {
  readonly zone: WatchedZone;
  readonly side: Side;
  readonly before: Side | null;
}

/** The side of each area watched, as fixes bear it out, and when each was last told of. */
export class ZoneWatch {
  readonly #sides = new Map<string, Side>();
  /** A new side seen once, waiting for a second fix to bear it out. */
  readonly #candidates = new Map<string, { readonly side: Side; readonly time: number }>();
  readonly #sentAt = new Map<string, number>();

  /** The side borne out for an area, if any. */
  side(key: string): Side | null {
    return this.#sides.get(key) ?? null;
  }

  /** The sides borne out, by area: a copy, which later fixes leave as it is. */
  sides(): ReadonlyMap<string, Side> {
    return new Map(this.#sides);
  }

  /** When each area was last told of from here, in milliseconds. */
  get sentAt(): ReadonlyMap<string, number> {
    return this.#sentAt;
  }

  /** An area was told of at `now`, in milliseconds. */
  sent(key: string, now: number): void {
    this.#sentAt.set(key, now);
  }

  /** Takes in a fix; returns the sides it bore out. Areas no longer watched are forgotten. */
  see(zones: readonly WatchedZone[], fix: ZoneFix): SideChange[] {
    const keys = new Set(zones.map((zone) => zone.key));
    for (const key of [...this.#sides.keys(), ...this.#candidates.keys()]) {
      if (keys.has(key)) continue;
      this.#sides.delete(key);
      this.#candidates.delete(key);
    }
    if (fix.accuracy === null || fix.accuracy > POOR_FIX_M) return [];
    const changes: SideChange[] = [];
    for (const zone of zones) {
      const side = sideOf(zone.shape.geometry, fix);
      if (side === null) continue;
      const before = this.side(zone.key);
      const candidate = this.#candidates.get(zone.key);
      if (side === before) {
        this.#candidates.delete(zone.key);
      } else if (candidate?.side !== side) {
        this.#candidates.set(zone.key, { side, time: fix.time });
      } else if (fix.time - candidate.time >= BORNE_OUT_MS) {
        this.#candidates.delete(zone.key);
        this.#sides.set(zone.key, side);
        changes.push({ zone, side, before });
      }
    }
    return changes;
  }
}

/** The newest crossing of `self` for each area, by its key: where the group last saw it. */
export function toldCrossings(
  crossings: readonly ZoneCrossingEvent[],
  self: NodeId,
): ReadonlyMap<string, ZoneCrossing> {
  const told = new Map<string, ZoneCrossing>();
  // In (time, origin, seq) order: the last one set is the newest.
  for (const crossing of crossings) {
    if (crossing.origin === self) told.set(eventRefKey(crossing.zone), crossing.crossing);
  }
  return told;
}

/**
 * The crossings to tell the group: for each area whose side is borne out, what differs from what
 * it last heard; an area it never heard of is told only once entered. `sentAt` holds when each
 * area was last told of here (ZoneWatch), so that no area is told of more than once a minute.
 */
export function dueCrossings(
  zones: readonly WatchedZone[],
  sides: ReadonlyMap<string, Side>,
  told: ReadonlyMap<string, ZoneCrossing>,
  sentAt: ReadonlyMap<string, number>,
  now: number,
): { readonly zone: WatchedZone; readonly crossing: ZoneCrossing }[] {
  return zones.flatMap((zone) => {
    const side = sides.get(zone.key);
    const last = told.get(zone.key);
    const due =
      (side === 'inside' && last !== 'entered') || (side === 'outside' && last === 'entered');
    const resting = now - (sentAt.get(zone.key) ?? -Infinity) < RETELL_MS;
    if (!due || resting) return [];
    return [{ zone, crossing: side === 'inside' ? ('entered' as const) : ('left' as const) }];
  });
}
