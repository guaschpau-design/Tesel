// What the map knows of a building tapped on the urban map (ADR-0158, ADR-0161): how high it is and
// how many floors it has, or about how many its height makes, what it is used for, the ground it
// covers, where its outline comes from, and its house numbers. All from the buildings archive,
// Overture Maps' (map/style/buildings.ts), and, in Spain, the official house numbers of IGN's map.

import { areaSquareMeters, nearestOnSegment } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Polygon, Position } from 'geojson';

import { insideRing } from '../map/geometry.ts';

/** A house number this close to a building's outline, in metres, is its own: portals stand on it. */
const NUMBER_REACH_M = 8;
/** A floor's height, to reckon floors from a height when they are not known. */
const FLOOR_M = 3;

/** What a building is used for, in a few kinds that matter to a team. */
const BUILDING_KINDS = [
  'homes',
  'industry',
  'commerce',
  'education',
  'health',
  'worship',
  'garage',
  'farm',
  'public',
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

/** Overture's classes of buildings (OpenStreetMap's "building" values), by kind. */
const CLASSES: Readonly<Record<BuildingKind, readonly string[]>> = {
  homes: [
    'apartments',
    'residential',
    'house',
    'detached',
    'semidetached_house',
    'terrace',
    'bungalow',
    'dormitory',
    'farmhouse',
  ],
  industry: ['industrial', 'warehouse', 'manufacture', 'factory', 'storage_tank'],
  commerce: ['commercial', 'retail', 'office', 'supermarket', 'hotel', 'kiosk'],
  education: ['school', 'university', 'college', 'kindergarten'],
  health: ['hospital'],
  worship: ['church', 'chapel', 'cathedral', 'mosque', 'synagogue', 'temple', 'religious'],
  garage: ['garage', 'garages', 'parking', 'carport'],
  farm: ['agricultural', 'farm_auxiliary', 'barn', 'cowshed', 'greenhouse', 'stable', 'sty'],
  public: [
    'public',
    'civic',
    'government',
    'fire_station',
    'police',
    'train_station',
    'transportation',
  ],
};

/** Where a building's outline comes from: whose map, or found in aerial imagery, roughly. */
export type OutlineSource =
  | { readonly kind: 'osm' }
  | { readonly kind: 'national' }
  | { readonly kind: 'imagery' }
  | { readonly kind: 'other'; readonly name: string };

export interface BuildingFacts {
  /** Its polygons, as the map has them, to show it. */
  readonly outline: readonly Polygon['coordinates'][];
  /** Metres from the ground to the top, where they are known. */
  readonly height: number | null;
  /** Its floors above ground: known, or reckoned from its height. */
  readonly floors: { readonly count: number; readonly known: boolean } | null;
  readonly kind: BuildingKind | null;
  readonly source: OutlineSource | null;
  /** Square metres of ground it covers, when the map's tile holds all of it. */
  readonly footprint: number | null;
  /** Its house numbers, in order. */
  readonly numbers: readonly string[];
}

/** A building as the buildings archive keeps it (apps/server/src/maps/slim-buildings.ts). */
export interface ArchivedBuilding {
  readonly polygons: readonly Polygon['coordinates'][];
  readonly height: number | null;
  readonly floors: number | null;
  /** Overture's class. */
  readonly class: string | null;
  /** Overture's name of the dataset its outline comes from. */
  readonly source: string | null;
}

/** A house number of IGN's map, and where it stands. */
export interface HouseNumber {
  readonly ref: string;
  readonly at: LatLon;
}

export function kindOf(buildingClass: string): BuildingKind | null {
  return BUILDING_KINDS.find((kind) => CLASSES[kind].includes(buildingClass)) ?? null;
}

/** Where an outline comes from, by the name Overture gives its dataset. */
export function sourceOf(dataset: string): OutlineSource {
  if (dataset === 'OpenStreetMap') return { kind: 'osm' };
  if (dataset.startsWith('Instituto Geográfico Nacional')) return { kind: 'national' };
  // Microsoft's and Google's buildings, found by machine learning in aerial imagery.
  if (/\bML\b|Open Buildings|Microsoft|Google/.test(dataset)) return { kind: 'imagery' };
  return { kind: 'other', name: dataset };
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
 * What is known of a building, `whole` when the map's tile holds all of it: the map cuts a building
 * at the edges of its tiles, so the ground it covers is told only then.
 */
export function buildingFacts(
  building: ArchivedBuilding,
  whole: boolean,
  houseNumbers: readonly HouseNumber[],
): BuildingFacts {
  const { polygons, height, floors } = building;
  const numbers = houseNumbers
    .filter(({ at }) => polygons.some((rings) => standsOn(rings, at)))
    .map(({ ref }) => ref);
  return {
    outline: polygons,
    height: height === null ? null : Math.round(height),
    floors:
      floors !== null
        ? { count: floors, known: true }
        : height !== null
          ? { count: Math.max(1, Math.round(height / FLOOR_M)), known: false }
          : null,
    kind: building.class === null ? null : kindOf(building.class),
    source: building.source === null ? null : sourceOf(building.source),
    footprint: whole ? Math.round(polygons.reduce((sum, rings) => sum + areaOf(rings), 0)) : null,
    numbers: [...new Set(numbers)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
  };
}
