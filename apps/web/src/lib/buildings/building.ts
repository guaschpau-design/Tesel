// What the map knows of a building tapped on the urban map (ADR-0158): how high it is and about how
// many floors that makes, the ground it covers, and its house numbers, from OpenStreetMap's
// buildings and, in Spain, the official house numbers of IGN's map.

import { areaSquareMeters, nearestOnSegment } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Polygon, Position } from 'geojson';

import { insideRing } from '../map/geometry.ts';

/** A house number this close to a building's outline, in metres, is its own: portals stand on it. */
const NUMBER_REACH_M = 8;
/** OpenStreetMap's base map reckons a floor 3 m high, and 2 m more for the roof. */
const FLOOR_M = 3;
const ROOF_M = 2;

export interface BuildingFacts {
  /** The outlines of its pieces, as the map has them, to show it. */
  readonly outline: readonly Polygon['coordinates'][];
  /** Metres from the ground to the top, where OpenStreetMap knows. */
  readonly height: number | null;
  /** About how many floors that height makes. */
  readonly floors: number | null;
  /** Square metres of ground it covers, when the map's tile holds all of it. */
  readonly footprint: number | null;
  /** Its house numbers, in order. */
  readonly numbers: readonly string[];
}

/** One polygon of a building, with its properties. */
export interface BuildingPiece {
  readonly rings: Polygon['coordinates'];
  readonly height: number | null;
  readonly number: string | null;
}

/** A house number of IGN's map, and where it stands. */
export interface HouseNumber {
  readonly ref: string;
  readonly at: LatLon;
}

/** About how many floors a building `height` metres high has. */
export function floorsOf(height: number): number {
  return Math.max(1, Math.round((height - ROOF_M) / FLOOR_M));
}

function toLatLon([lon = 0, lat = 0]: Position): LatLon {
  return { lat, lon };
}

/** Whether a house number stands in a building or on its outline. */
function standsOn(rings: Polygon['coordinates'], at: LatLon): boolean {
  const [outer] = rings;
  if (outer === undefined) return false;
  const ring = outer.map(([lon = 0, lat = 0]) => [lon, lat] as const);
  if (insideRing(ring, at)) return true;
  for (let index = 1; index < outer.length; index++) {
    const start = outer[index - 1];
    const end = outer[index];
    if (start === undefined || end === undefined) continue;
    if (nearestOnSegment(at, toLatLon(start), toLatLon(end)).meters <= NUMBER_REACH_M) return true;
  }
  return false;
}

/** The ground a polygon covers, its holes left out. */
function areaOf([outer, ...holes]: Polygon['coordinates']): number {
  if (outer === undefined) return 0;
  const area = (ring: Position[]) => areaSquareMeters(ring.map(toLatLon));
  return holes.reduce((sum, hole) => sum - area(hole), area(outer));
}

/**
 * What is known of a building from its polygons, `whole` when the map's tile holds all of it: the
 * map cuts a building at the edges of its tiles, so the ground it covers is told only then.
 */
export function buildingFacts(
  pieces: readonly BuildingPiece[],
  whole: boolean,
  houseNumbers: readonly HouseNumber[],
): BuildingFacts {
  const heights = pieces.flatMap((piece) => (piece.height === null ? [] : [piece.height]));
  const height = heights.length === 0 ? null : Math.max(...heights);
  const numbers = new Set(pieces.flatMap((piece) => (piece.number === null ? [] : [piece.number])));
  for (const { ref, at } of houseNumbers) {
    if (pieces.some((piece) => standsOn(piece.rings, at))) numbers.add(ref);
  }
  return {
    outline: pieces.map((piece) => piece.rings),
    height: height === null ? null : Math.round(height),
    floors: height === null ? null : floorsOf(height),
    footprint: whole
      ? Math.round(pieces.reduce((sum, piece) => sum + areaOf(piece.rings), 0))
      : null,
    numbers: [...numbers].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
  };
}
