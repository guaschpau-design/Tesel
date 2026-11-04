// How much a straight way climbs and descends, and its steepest stretch, from elevations sampled
// along it, every 30 m: often enough for a way on foot, and slopes are taken over a few samples,
// not between neighbours, to keep noise out.

import { distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

/** How far apart the way is sampled. */
const SAMPLE_SPACING_M = 30;
/** Long ways are sampled less densely, to keep the work bounded. */
const MAX_SAMPLES = 200;
/** Slopes are measured over this many samples (about 90 m). */
const SLOPE_SPAN = 3;

export interface Climb {
  /** Metres gone up and down along the way. */
  readonly up: number;
  readonly down: number;
  /** The steepest stretch, as a percentage (100 % is 45°). */
  readonly steepest: number;
}

/** Metres of climb as they are told, to the nearest 5 m: the data is not finer. */
export function climbMetres(value: number): string {
  return String(Math.round(value / 5) * 5);
}

/** Points along the straight way from `from` to `to`, both included. */
export function samplesAlong(from: LatLon, to: LatLon): LatLon[] {
  const length = distanceMeters(from, to);
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(length / SAMPLE_SPACING_M) + 1));
  return Array.from({ length: count }, (_, index) => {
    const share = index / (count - 1);
    return {
      lat: from.lat + (to.lat - from.lat) * share,
      lon: from.lon + (to.lon - from.lon) * share,
    };
  });
}

/** The climb along samples and their elevations; null if any elevation is unknown. */
export function climbOf(
  samples: readonly LatLon[],
  elevations: readonly (number | null)[],
): Climb | null {
  if (elevations.length !== samples.length || elevations.some((value) => value === null)) {
    return null;
  }
  const heights = elevations as readonly number[];
  let up = 0;
  let down = 0;
  for (let index = 1; index < heights.length; index++) {
    const change = (heights[index] ?? 0) - (heights[index - 1] ?? 0);
    if (change > 0) up += change;
    else down -= change;
  }
  let steepest = 0;
  for (let index = SLOPE_SPAN; index < heights.length; index++) {
    const start = samples[index - SLOPE_SPAN];
    const end = samples[index];
    if (start === undefined || end === undefined) continue;
    const run = distanceMeters(start, end);
    const rise = Math.abs((heights[index] ?? 0) - (heights[index - SLOPE_SPAN] ?? 0));
    if (run > 0) steepest = Math.max(steepest, (rise / run) * 100);
  }
  return { up, down, steepest };
}
