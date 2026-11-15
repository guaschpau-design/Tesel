// How much a way climbs and descends, and its steepest stretch, from elevations sampled along it,
// every 30 m: a straight way to a point, or a path measured on the map (ADR-0135); often enough for a way on foot, and slopes are taken over a few samples,
// not between neighbours, to keep noise out.

import { distanceMeters, pathMeters } from '@tesel/core';
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

/**
 * Points evenly spread along a path, its first and last points included, so that a profile drawn
 * from them is to scale along the way however its stretches differ in length.
 */
export function samplesAlong(path: readonly LatLon[]): LatLon[] {
  const first = path[0];
  if (first === undefined) return [];
  const length = pathMeters(path);
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(length / SAMPLE_SPACING_M) + 1));
  const samples: LatLon[] = [];
  /** The stretch reached so far, and how far along the path it starts. */
  let stretch = 0;
  let before = 0;
  for (let index = 0; index < count; index++) {
    const along = length === 0 ? 0 : (length * index) / (count - 1);
    let start = path[stretch] ?? first;
    let end = path[stretch + 1] ?? start;
    let span = distanceMeters(start, end);
    while (stretch < path.length - 2 && before + span < along) {
      before += span;
      stretch += 1;
      start = end;
      end = path[stretch + 1] ?? start;
      span = distanceMeters(start, end);
    }
    const share = span === 0 ? 0 : Math.min(1, (along - before) / span);
    samples.push({
      lat: start.lat + (end.lat - start.lat) * share,
      lon: start.lon + (end.lon - start.lon) * share,
    });
  }
  return samples;
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
