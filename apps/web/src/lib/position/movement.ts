// When a change of position is a move and not the GPS wandering (ADR-0092, ADR-0119). A fix is
// only as good as its accuracy, the radius within which the device is: two fixes of a device
// standing still can lie as far apart as their two radii together. So a move is a change larger
// than both radii, and never less than a few metres. Indoors, though, phones claim radii smaller
// than their jumps, so a change is not taken for a move until what comes after bears it out: the
// device goes on the same way, or stays away for a minute. The same rules decide what this
// device publishes and which positions draw a trail and sweep a strip.

import { distanceMeters } from '@tesel/core';
import type { LatLon, PositionEvent } from '@tesel/protocol';

import { accuracyQuality } from './accuracy.ts';

/** A place as the GPS gave it, with its accuracy in metres when known. */
export interface Placed {
  readonly at: LatLon;
  readonly accuracy: number | null;
}

/** A place with when it was, in seconds since the epoch. */
export interface Timed extends Placed {
  readonly time: number;
}

/** The smallest change counted as a move, however sharp the fixes. */
const MIN_MOVE_M = 10;
/** How long a device must stay away from where it was for a move that goes no further to count. */
const HOLD_S = 60;

/** What the places after a change say of it: a move, the GPS wandering, or not yet known. */
export type Confirmation = 'move' | 'wandering' | 'unsure';

/**
 * Whether going from `from` to `to` is more than the two fixes' uncertainty, and at least `least`
 * metres.
 */
export function isMove(from: Placed, to: Placed, least = MIN_MOVE_M): boolean {
  const margin = (from.accuracy ?? 0) + (to.accuracy ?? 0);
  return distanceMeters(from.at, to.at) >= Math.max(least, margin);
}

/**
 * Whether `candidate`, a change from `from` beyond their uncertainty, is a move, by the places that
 * came after it (`later`, oldest first). It is when the device went on the same way: a later
 * place is a move from the candidate too, and further from `from`; or when it stayed away, on the
 * candidate's side, for HOLD_S. It is the GPS wandering as soon as a later place is back within
 * reach of `from`, or nearer `from` than the candidate: jumps of a device standing still go every
 * way and come back.
 */
export function confirmMove(from: Placed, candidate: Timed, later: readonly Timed[]): Confirmation {
  for (const place of later) {
    const fromStart = distanceMeters(from.at, place.at);
    if (!isMove(from, place) || distanceMeters(candidate.at, place.at) >= fromStart) {
      return 'wandering';
    }
    if (isMove(candidate, place) && fromStart > distanceMeters(from.at, candidate.at))
      return 'move';
    if (place.time - candidate.time >= HOLD_S) return 'move';
  }
  return 'unsure';
}

/** Each trail's travelled positions, worked out once: a trail is a new array whenever it grows. */
const travelledOf = new WeakMap<readonly PositionEvent[], readonly PositionEvent[]>();

/**
 * Where a member went, from their trail: positions of poor accuracy are left out, and each one
 * kept is a move from the last one kept that the positions after it bear out (`confirmMove`); the
 * newest stays out until they do. Every device draws the same from the same trail.
 */
export function travelled(points: readonly PositionEvent[]): readonly PositionEvent[] {
  let kept = travelledOf.get(points);
  if (kept === undefined) {
    kept = keptMoves(points);
    travelledOf.set(points, kept);
  }
  return kept;
}

function keptMoves(points: readonly PositionEvent[]): PositionEvent[] {
  const sharp = points.filter(
    (point) => point.accuracy === null || accuracyQuality(point.accuracy) !== 'poor',
  );
  const places = sharp.map(placed);
  const kept: PositionEvent[] = [];
  let last: Timed | undefined;
  places.forEach((place, index) => {
    const point = sharp.at(index);
    if (point === undefined) return;
    if (last !== undefined) {
      if (!isMove(last, place)) return;
      if (confirmMove(last, place, places.slice(index + 1)) !== 'move') return;
    }
    kept.push(point);
    last = place;
  });
  return kept;
}

function placed(point: PositionEvent): Timed {
  return { at: { lat: point.lat, lon: point.lon }, accuracy: point.accuracy, time: point.time };
}
