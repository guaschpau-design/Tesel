// Geometry helpers for the map. Distances come from @tesel/core.

import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { boundsAround, type Bounds } from './tiles/math.ts';

/** A circle as a closed ring of [lon, lat] positions, for drawing. */
export function circleRing(center: LatLon, radius: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push(toPosition(offsetMeters(center, radius * Math.cos(angle), radius * Math.sin(angle))));
  }
  return ring;
}

/** Web Mercator, as MapLibre draws it, projects a sphere of this radius. */
const WEB_MERCATOR_RADIUS_M = 6_378_137;
/** So the map wraps the equator: 2π times the radius. */
const MAP_CIRCUMFERENCE_M = 2 * Math.PI * WEB_MERCATOR_RADIUS_M;
/** MapLibre's tiles are 512 pixels wide. */
const TILE_PX = 512;

/** Metres on the ground for one pixel of the map, at a zoom and a latitude. */
export function metresPerPixel(zoom: number, lat: number): number {
  return (MAP_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * 2 ** zoom);
}

/** A point in Web Mercator metres (EPSG:3857), as web map services take them: [x, y]. */
export function toWebMercator({ lat, lon }: LatLon): [number, number] {
  const rad = (lat * Math.PI) / 180;
  return [
    (WEB_MERCATOR_RADIUS_M * lon * Math.PI) / 180,
    WEB_MERCATOR_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + rad / 2)),
  ];
}

/** The least zoom at which a point is shown: where a street and its buildings can be told apart. */
const SHOW_ZOOM = 15;

/** Flies to a point, closer if the map is further out than a street's detail. */
export function showPoint(map: MapLibreMap, at: LatLon): void {
  map.flyTo({ center: [at.lon, at.lat], zoom: Math.max(map.getZoom(), SHOW_ZOOM) });
}

/** Room around points shown together, in CSS pixels, so none sits under a card or the dock. */
const SHOW_PADDING_PX = 80;

/** Frames some points, not closer than a street's detail. */
export function showPoints(map: MapLibreMap, points: readonly LatLon[]): void {
  const { west, south, east, north } = boundsAround(points);
  map.fitBounds([toPosition({ lat: south, lon: west }), toPosition({ lat: north, lon: east })], {
    padding: SHOW_PADDING_PX,
    maxZoom: SHOW_ZOOM,
  });
}

/** What the map's view shows, edge to edge. */
export function mapBounds(map: MapLibreMap): Bounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

export function toPosition(point: LatLon): [number, number] {
  return [point.lon, point.lat];
}

/**
 * Whether a point is inside a ring of [lon, lat] positions, by ray casting: a ray from the point
 * crosses the ring an odd number of times. Fine at the scale of a town or a region.
 */
export function insideRing(
  ring: readonly (readonly [number, number])[],
  { lat, lon }: LatLon,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as readonly [number, number];
    const [xj, yj] = ring[j] as readonly [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How much of a box a ring covers. */
export type Coverage = 'none' | 'part' | 'all';

/**
 * How much of `bounds` lies inside a ring of [lon, lat] positions: all of it when every corner is
 * inside and the ring's edge does not enter the box, none when no corner is inside and the edge does
 * not enter it either, part otherwise.
 */
function ringCoverage(ring: readonly (readonly [number, number])[], bounds: Bounds): Coverage {
  const { west, south, east, north } = bounds;
  const corners = [
    { lon: west, lat: south },
    { lon: east, lat: south },
    { lon: east, lat: north },
    { lon: west, lat: north },
  ];
  const inside = corners.filter((corner) => insideRing(ring, corner)).length;
  if (inside > 0 && inside < corners.length) return 'part';
  const entersBox = ring.some(([lon, lat], i) => {
    if (lon > west && lon < east && lat > south && lat < north) return true;
    const next = ring[i + 1];
    return next !== undefined && segmentCrossesBox([lon, lat], next, bounds);
  });
  if (entersBox) return 'part';
  return inside === 0 ? 'none' : 'all';
}

/** How much of `bounds` an outline of separate rings covers: all of it within one ring, or none. */
export function outlineCoverage(
  outline: readonly (readonly (readonly [number, number])[])[],
  bounds: Bounds,
): Coverage {
  const coverages = outline.map((ring) => ringCoverage(ring, bounds));
  if (coverages.includes('all')) return 'all';
  return coverages.includes('part') ? 'part' : 'none';
}

/** Whether a segment crosses one of the box's sides. */
function segmentCrossesBox(
  a: readonly [number, number],
  b: readonly [number, number],
  { west, south, east, north }: Bounds,
): boolean {
  const sides: [[number, number], [number, number]][] = [
    [
      [west, south],
      [east, south],
    ],
    [
      [east, south],
      [east, north],
    ],
    [
      [east, north],
      [west, north],
    ],
    [
      [west, north],
      [west, south],
    ],
  ];
  return sides.some(([c, d]) => segmentsCross(a, b, c, d));
}

function segmentsCross(
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
  [cx, cy]: readonly [number, number],
  [dx, dy]: readonly [number, number],
): boolean {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return (
    side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 &&
    side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0
  );
}
