// Whether a radio reaches a point from here over the ground (ADR-0159): LoRa, as the mesh's radios
// (MeshCore) use, needs a line of sight, and more: the first Fresnel zone, the spindle round that
// line the signal travels in, mostly clear. Worked out from the elevation tiles alone, with the
// earth's curve as radio sees it (bent back by the air, a third larger), so without buildings or
// trees.

import { distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

import { samplesAlong } from './climb.ts';
import type { Heights } from './elevation.ts';

/** The antennas' heights above the ground offered, in metres: held in the hand, or on a mast. */
export const ANTENNA_HEIGHTS = [1.5, 5, 10] as const;
export type AntennaHeight = (typeof ANTENNA_HEIGHTS)[number];

/** LoRa in Europe: 868 MHz. */
const WAVELENGTH_M = 299_792_458 / 868e6;
/** The earth's radius as radio sees it: the usual four thirds. */
const RADIO_EARTH_M = (6_371_000 * 4) / 3;
/** Less of the first Fresnel zone clear than this, the signal weakens. */
const CLEAR_SHARE = 0.6;

/** One point of the way: how far out, the ground there, and the signal's line and zone. */
interface LinkPoint {
  readonly metres: number;
  /** The ground, raised by the earth's curve between the ends, as the signal meets it. */
  readonly ground: number;
  /** The straight line between the antennas. */
  readonly line: number;
  /** The radius of the first Fresnel zone there. */
  readonly zone: number;
}

type LinkVerdict =
  | { readonly kind: 'clear' }
  /** The ground within the zone, at `metres` from here: the signal may arrive weak. */
  | { readonly kind: 'grazing'; readonly metres: number }
  /** The ground above the line, highest at `metres` from here, `height` m above the sea. */
  | {
      readonly kind: 'blocked';
      readonly metres: number;
      readonly height: number;
      /** Where the line first meets the ground. */
      readonly from: number;
    };

export interface RadioLink {
  readonly length: number;
  readonly points: readonly LinkPoint[];
  readonly verdict: LinkVerdict;
}

/**
 * The link between two antennas `antenna` metres above the ground, over the ground's `heights`
 * at points evenly spread along a way `length` metres long.
 */
export function linkOver(
  heights: readonly number[],
  length: number,
  antenna: number,
): RadioLink | null {
  const first = heights[0];
  const last = heights.at(-1);
  if (first === undefined || last === undefined || heights.length < 2) return null;
  const start = first + antenna;
  const end = last + antenna;
  const points = heights.map((height, index): LinkPoint => {
    const metres = (length * index) / (heights.length - 1);
    const rest = length - metres;
    return {
      metres,
      ground: height + (metres * rest) / (2 * RADIO_EARTH_M),
      line: start + ((end - start) * metres) / length,
      zone: length === 0 ? 0 : Math.sqrt((WAVELENGTH_M * metres * rest) / length),
    };
  });
  return { length, points, verdict: verdictOf(points, heights) };
}

function verdictOf(points: readonly LinkPoint[], heights: readonly number[]): LinkVerdict {
  let worst: { index: number; above: number } | null = null;
  let firstBlocked: number | null = null;
  let tightest: { index: number; share: number } | null = null;
  // The ends are the antennas' own ground.
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    if (point === undefined) continue;
    const above = point.ground - point.line;
    if (above > 0) {
      firstBlocked ??= index;
      if (worst === null || above > worst.above) worst = { index, above };
    }
    const share = point.zone === 0 ? 1 : (point.line - point.ground) / point.zone;
    if (tightest === null || share < tightest.share) tightest = { index, share };
  }
  if (worst !== null && firstBlocked !== null) {
    return {
      kind: 'blocked',
      metres: points[worst.index]?.metres ?? 0,
      height: heights[worst.index] ?? 0,
      from: points[firstBlocked]?.metres ?? 0,
    };
  }
  if (tightest !== null && tightest.share < CLEAR_SHARE) {
    return { kind: 'grazing', metres: points[tightest.index]?.metres ?? 0 };
  }
  return { kind: 'clear' };
}

/** The link from `from` to `to`, its elevations read from `heights`; null where any is unknown. */
export async function radioLink(
  heights: Heights,
  from: LatLon,
  to: LatLon,
  antenna: number,
): Promise<RadioLink | null> {
  const samples = samplesAlong([from, to]);
  const elevations = await heights.elevations(samples);
  const known = elevations.filter((value) => value !== null);
  if (known.length !== elevations.length) return null;
  return linkOver(known, distanceMeters(from, to), antenna);
}
