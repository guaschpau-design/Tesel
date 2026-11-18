// The MGRS grid's digits at the edges of the screen, as a military map prints them in its margins
// (ADR-0141): each line's digits where it leaves the screen on the left or at the bottom, so that
// a position is read off the edges without hunting for the digits along the lines.

import type { Feature, FeatureCollection, Point } from 'geojson';

/** A point on the screen, in CSS pixels from its top left corner. */
interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** The map as seen: its size on screen, and the way between places and the screen. */
export interface Screen {
  readonly width: number;
  readonly height: number;
  project(lonLat: readonly [number, number]): ScreenPoint;
  unproject(point: ScreenPoint): readonly [number, number];
}

/** How far in from the screen's left and bottom edges the digits are written, in CSS pixels. */
export const EDGE_INSET = 14;

/**
 * How far past its ends a line is carried on, as a share of the screen's longer side: past the piece
 * of curve it may stop short by, not so far that a line of one UTM zone reaches into the next.
 */
const REACH_SHARE = 8;

type Edge = 'left' | 'bottom';

/** The digits of each labelled grid line where it meets the left and the bottom edge. */
export function gridEdgeLabels(grid: FeatureCollection, screen: Screen): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  const left = EDGE_INSET;
  const bottom = screen.height - EDGE_INSET;
  for (const feature of grid.features) {
    const properties = feature.properties ?? {};
    const label: unknown = properties['label'];
    if (properties['kind'] !== 'line' || typeof label !== 'string' || label === '') continue;
    if (feature.geometry.type !== 'LineString') continue;
    const points = extended(
      feature.geometry.coordinates.map(([lon = 0, lat = 0]) => screen.project([lon, lat])),
      Math.max(screen.width, screen.height) / REACH_SHARE,
    );
    const onLeft = crossing(
      points,
      (point) => point.x - left,
      (point) => inside(point.y, bottom),
    );
    const onBottom = crossing(
      points,
      (point) => point.y - bottom,
      (point) => inside(point.x, screen.width) && point.x > left,
    );
    if (onLeft !== null) features.push(labelAt(screen.unproject(onLeft), label, 'left'));
    if (onBottom !== null) features.push(labelAt(screen.unproject(onBottom), label, 'bottom'));
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Where a polyline on screen first crosses the line on which `side` is zero, if that point is one
 * to keep.
 */
function crossing(
  points: readonly ScreenPoint[],
  side: (point: ScreenPoint) => number,
  keep: (point: ScreenPoint) => boolean,
): ScreenPoint | null {
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (from === undefined || to === undefined) continue;
    const a = side(from);
    const b = side(to);
    if (a === b || Math.sign(a) === Math.sign(b)) continue;
    const share = a / (a - b);
    const point = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
    if (keep(point)) return point;
  }
  return null;
}

/**
 * A line drawn to just inside the screen stops short of its edge, by a piece of its curve: each end
 * is carried on along its last piece, as straight as grid lines are at that scale, so that it
 * meets the edges.
 */
function extended(points: readonly ScreenPoint[], reach: number): ScreenPoint[] {
  const [first, second] = points;
  const [last, beforeLast] = [points.at(-1), points.at(-2)];
  if (!first || !second || !last || !beforeLast) return [...points];
  return [onwards(second, first, reach), ...points, onwards(beforeLast, last, reach)];
}

/** The point `reach` pixels on from `to`, in the way from `from` to `to`. */
function onwards(from: ScreenPoint, to: ScreenPoint, reach: number): ScreenPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) return to;
  return {
    x: to.x + ((to.x - from.x) / length) * reach,
    y: to.y + ((to.y - from.y) / length) * reach,
  };
}

function inside(value: number, size: number): boolean {
  return value >= 0 && value <= size;
}

function labelAt(lonLat: readonly [number, number], label: string, edge: Edge): Feature<Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lonLat[0], lonLat[1]] },
    properties: { label, edge },
  };
}
