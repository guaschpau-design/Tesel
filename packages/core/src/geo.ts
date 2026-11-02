// Distances, bearings and areas on the Earth, for position thinning, drawing, measuring and
// navigating. A sphere of the mean radius is accurate to about 0.5 %, plenty for all of them.

import type { LatLon } from '@tesel/protocol';

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6_371_000;

const RAD = Math.PI / 180;

/** Half a turn of longitude, in degrees. */
const HALF_TURN = 180;
/** The poles' latitude, in degrees. */
const POLE = 90;

/**
 * The point `north` and `east` metres from `from` (negative for south and west), on a plane
 * fitted at `from`: for drawing circles and placing points a few kilometres away, not for long
 * journeys. Where the plane no longer fits, near a pole or far away (protocol §3.7), the latitude
 * stops at the pole, never past it, and the longitude at half a turn east or west of `from`, which
 * keeps a ring drawn around `from` in one piece.
 */
export function offsetMeters(from: LatLon, north: number, east: number): LatLon {
  const eastDegrees = east / (EARTH_RADIUS_M * Math.cos(from.lat * RAD)) / RAD;
  return {
    lat: clamp(from.lat + north / EARTH_RADIUS_M / RAD, -POLE, POLE),
    lon: from.lon + clamp(eastDegrees, -HALF_TURN, HALF_TURN),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How far `point` is east and north of `origin`, in metres: the reverse of `offsetMeters`. */
export function eastNorthMeters(origin: LatLon, point: LatLon): PlaneOffset {
  return {
    east: (point.lon - origin.lon) * RAD * EARTH_RADIUS_M * Math.cos(origin.lat * RAD),
    north: (point.lat - origin.lat) * RAD * EARTH_RADIUS_M,
  };
}

/** Metres east and north of a point, on a plane fitted there. */
export interface PlaneOffset {
  readonly east: number;
  readonly north: number;
}

/** Where a segment passes closest to a point. */
export interface SegmentPoint {
  /** The point of the segment nearest to the one given. */
  readonly at: LatLon;
  /** How far along the segment that is: 0 at its start, 1 at its end. */
  readonly along: number;
  /** Metres from the point given. */
  readonly meters: number;
}

/**
 * The point of the segment from `start` to `end` nearest to `point`, on a plane fitted at
 * `point`: exact enough for segments a few tens of kilometres long.
 */
export function nearestOnSegment(point: LatLon, start: LatLon, end: LatLon): SegmentPoint {
  const a = eastNorthMeters(point, start);
  const b = eastNorthMeters(point, end);
  const east = b.east - a.east;
  const north = b.north - a.north;
  const lengthSquared = east ** 2 + north ** 2;
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, -(a.east * east + a.north * north) / lengthSquared));
  const nearest = { east: a.east + along * east, north: a.north + along * north };
  return {
    at: offsetMeters(point, nearest.north, nearest.east),
    along,
    meters: Math.hypot(nearest.east, nearest.north),
  };
}

/** Great-circle distance (haversine), in metres. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The direction to set off from `a` to reach `b`, in degrees clockwise from true north, 0–360. */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const dLon = (b.lon - a.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Length of a path through the points in order, in metres. */
export function pathMeters(points: readonly LatLon[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (from && to) total += distanceMeters(from, to);
  }
  return total;
}

/**
 * Area enclosed by a ring of points, in square metres, on a plane fitted at the ring's centre.
 * Good to well under 1 % for areas a team draws (up to tens of kilometres across).
 */
export function areaSquareMeters(ring: readonly LatLon[]): number {
  if (ring.length < 3) return 0;
  const centreLat = ring.reduce((sum, point) => sum + point.lat, 0) / ring.length;
  // Metres east and north of a point at the ring's mean latitude.
  const origin = { lat: centreLat, lon: ring[0]?.lon ?? 0 };
  const plane = ring.map((point) => eastNorthMeters(origin, point));
  let twice = 0;
  for (const [index, point] of plane.entries()) {
    const next = plane[(index + 1) % plane.length] ?? point;
    twice += point.east * next.north - next.east * point.north;
  }
  return Math.abs(twice) / 2;
}
