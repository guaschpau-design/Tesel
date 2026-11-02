// The MGRS grid over a view of the map: lines every 100 km, 10 km, 1 km or 100 m, whichever leaves
// a comfortable gap on screen, each labelled with its digits as MGRS writes them ("25" for the
// 1 km line at easting 725 000); the 100 km squares named ("30S YJ"); and the edges of UTM zones.
// Lines are straight in UTM, so on the map they are drawn as short segments that follow its curve.

import type { LatLon } from '@tesel/protocol';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { metresPerPixel } from '../map/geometry.ts';
import { toMgrs } from './mgrs.ts';
import { bandOf, fromUtm, toUtmInZone, zoneWest } from './utm.ts';

export interface View {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
  /** MapLibre's zoom: 512-pixel tiles. */
  readonly zoom: number;
}

/** What a feature of the grid is: a grid line, the edge of a zone, or the name of a square. */
type GridKind = 'line' | 'zone' | 'square';

/** Line spacings, finest first, in metres. */
const SPACINGS = [100, 1_000, 10_000, 100_000] as const;
/** Lines closer than this on screen, in pixels, would hide the map. */
const MIN_GAP_PX = 90;
const SQUARE = 100_000;
/** Each line is drawn as this many straight pieces. */
const SEGMENTS = 16;
/** UTM reaches from 80° S to 84° N; the grid does too. */
const SOUTH_LIMIT = -80;
const NORTH_LIMIT = 84;
/** The southern grid ends this close below the equator, in degrees, still in its hemisphere. */
const EQUATOR_GAP = 1e-9;

/** The finest spacing that leaves the lines at least MIN_GAP_PX apart, or null if none does. */
export function gridSpacing(zoom: number, lat: number): number | null {
  const scale = metresPerPixel(zoom, lat);
  return SPACINGS.find((spacing) => spacing / scale >= MIN_GAP_PX) ?? null;
}

/** The grid over a view, as features with a `kind` and, for lines and squares, a `label`. */
export function mgrsGrid(view: View): FeatureCollection {
  const south = Math.max(view.south, SOUTH_LIMIT);
  const north = Math.min(view.north, NORTH_LIMIT);
  const spacing = gridSpacing(view.zoom, (south + north) / 2);
  const features: Feature[] = [];
  if (spacing === null || south >= north) return { type: 'FeatureCollection', features };
  const first = zoneAt(view.west);
  const last = zoneAt(view.east);
  for (let zone = first; zone <= last; zone++) {
    const west = Math.max(view.west, zoneWest(zone));
    const east = Math.min(view.east, zoneWest(zone) + 6);
    // Northings start again at the equator: each hemisphere has a grid of its own.
    if (south < 0 && north > 0) {
      features.push(...zoneGrid(zone, { west, south, east, north: -EQUATOR_GAP }, spacing));
      features.push(...zoneGrid(zone, { west, south: 0, east, north }, spacing));
    } else {
      features.push(...zoneGrid(zone, { west, south, east, north }, spacing));
    }
    if (zone > first) features.push(zoneEdge(zoneWest(zone), south, north));
  }
  return { type: 'FeatureCollection', features };
}

interface Box {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

function zoneGrid(zone: number, box: Box, spacing: number): Feature[] {
  const band = bandOf((box.south + box.north) / 2);
  // The view's extent in this zone's metres: its corners, and the middle of its top and bottom,
  // where the zone's curved parallels bulge most.
  const middle = (box.west + box.east) / 2;
  const corners = [box.west, middle, box.east].flatMap((lon) =>
    [box.south, box.north].map((lat) => toUtmInZone({ lat, lon }, zone)),
  );
  const eastings = corners.map((utm) => utm.easting);
  const northings = corners.map((utm) => utm.northing);
  const range = {
    minE: Math.min(...eastings),
    maxE: Math.max(...eastings),
    minN: Math.min(...northings),
    maxN: Math.max(...northings),
  };
  const at = (easting: number, northing: number): LatLon =>
    fromUtm({ zone, band, easting, northing });
  const inZone = (point: LatLon) => point.lon >= box.west && point.lon <= box.east;
  const features: Feature[] = [];

  for (const easting of multiples(range.minE, range.maxE, spacing)) {
    const points = steps(range.minN, range.maxN).map((northing) => at(easting, northing));
    features.push(...clipped(points, inZone, label(easting, spacing)));
  }
  for (const northing of multiples(range.minN, range.maxN, spacing)) {
    const points = steps(range.minE, range.maxE).map((easting) => at(easting, northing));
    features.push(...clipped(points, inZone, label(northing, spacing)));
  }
  // The squares, named at the middle of what is seen of each.
  for (const e of multiples(range.minE - SQUARE, range.maxE, SQUARE)) {
    for (const n of multiples(range.minN - SQUARE, range.maxN, SQUARE)) {
      const centre = at(
        (Math.max(e, range.minE) + Math.min(e + SQUARE, range.maxE)) / 2,
        (Math.max(n, range.minN) + Math.min(n + SQUARE, range.maxN)) / 2,
      );
      if (!inZone(centre)) continue;
      const mgrs = toMgrs(toUtmInZone(centre, zone), 0);
      features.push(point(centre, 'square', `${mgrs.zone}${mgrs.band} ${mgrs.square}`));
    }
  }
  return features;
}

/** A grid line's digits, as MGRS writes them within the 100 km square at this spacing. */
function label(metres: number, spacing: number): string | null {
  if (spacing >= SQUARE) return null;
  const digits = Math.round(Math.log10(SQUARE / spacing));
  return String(Math.round((metres % SQUARE) / spacing)).padStart(digits, '0');
}

/** Every multiple of `step` from `min` to `max`. */
function multiples(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) values.push(value);
  return values;
}

function steps(from: number, to: number): number[] {
  return Array.from({ length: SEGMENTS + 1 }, (_, k) => from + ((to - from) * k) / SEGMENTS);
}

/** The runs of a line that lie inside its zone, as features. */
function clipped(points: readonly LatLon[], keep: (point: LatLon) => boolean, text: string | null) {
  const runs: LatLon[][] = [];
  let run: LatLon[] = [];
  for (const point of points) {
    if (keep(point)) {
      run.push(point);
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs.filter((part) => part.length > 1).map((part) => line(part, 'line', text));
}

function zoneEdge(lon: number, south: number, north: number): Feature<LineString> {
  return line(
    [
      { lat: south, lon },
      { lat: north, lon },
    ],
    'zone',
    null,
  );
}

function line(points: readonly LatLon[], kind: GridKind, text: string | null): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: points.map(({ lat, lon }) => [lon, lat]) },
    properties: { kind, label: text ?? '' },
  };
}

function point(at: LatLon, kind: GridKind, text: string): Feature<Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [at.lon, at.lat] },
    properties: { kind, label: text },
  };
}

/** The standard six-degree zone of a longitude, 1 to 60. */
function zoneAt(lon: number): number {
  return Math.min(Math.max(Math.floor((lon + 180) / 6) + 1, 1), 60);
}
