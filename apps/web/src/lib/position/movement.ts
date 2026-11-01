// When a change of position is a move and not the GPS wandering (ADR-0092). A fix is only as
// good as its accuracy, the radius within which the device is: two fixes of a device standing
// still can lie as far apart as their two radii together, which indoors is tens of metres. So a
// move is a change larger than both radii, and never less than a few metres. The same rule decides
// what this device publishes and which positions draw a trail and sweep a strip.

import { distanceMeters } from '@tesel/core';
import type { LatLon, PositionEvent } from '@tesel/protocol';

import { accuracyQuality } from './accuracy.ts';

/** A place as the GPS gave it, with its accuracy in metres when known. */
export interface Placed {
  readonly at: LatLon;
  readonly accuracy: number | null;
}

/** The smallest change counted as a move, however sharp the fixes. */
const MIN_MOVE_M = 10;

/** Whether going from `from` to `to` is more than the two fixes' uncertainty. */
export function isMove(from: Placed, to: Placed): boolean {
  const margin = (from.accuracy ?? 0) + (to.accuracy ?? 0);
  return distanceMeters(from.at, to.at) >= Math.max(MIN_MOVE_M, margin);
}

/**
 * Where a member went, from their trail: positions of poor accuracy are left out, and each one
 * kept is a move from the last one kept. Every device draws the same from the same trail.
 */
export function travelled(points: readonly PositionEvent[]): PositionEvent[] {
  const kept: PositionEvent[] = [];
  for (const point of points) {
    if (point.accuracy !== null && accuracyQuality(point.accuracy) === 'poor') continue;
    const previous = kept.at(-1);
    if (previous === undefined || isMove(placed(previous), placed(point))) kept.push(point);
  }
  return kept;
}

function placed(point: PositionEvent): Placed {
  return { at: { lat: point.lat, lon: point.lon }, accuracy: point.accuracy };
}
