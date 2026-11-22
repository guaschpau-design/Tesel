// Builds the archive of aid points the server publishes at /maps/aid-points.pmtiles (ADR-0165):
// defibrillators, fire hydrants and drinking water, as OpenStreetMap maps them in an area, which
// the app draws among its public services. The base map's builds leave them out. deploy/vps/
// aid-points.sh runs it every week in the server's image:
//
//   node apps/server/src/maps/build-aid-points.ts --bbox=WEST,SOUTH,EAST,NORTH --out=FILE
//
// They are asked of the Overpass API a few degrees at a time, one request after another, as its
// rules ask; each part of its main instance, then of another, and tried again a few times before
// the build gives up.

import { parseArgs } from 'node:util';

import type { Feature, FeatureCollection, Point } from 'geojson';

import { parseBounds, type Bounds } from './area.ts';
import { attempt, fetchJson } from './fetching.ts';
import { writeLayerArchive } from './geojson-archive.ts';

/** Overpass's main instance, and another one with the same data if it does not answer. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
/** Degrees of longitude and latitude asked for at once: a city's hydrants in one answer. */
const CELL_DEGREES = 3;
/** Overpass asks those who are refused to wait before asking again. */
const FIRST_WAIT_MS = 30_000;

const AID_LAYER = 'point';
/** The zooms the app reads aid points at (map/tiles/sources.ts); it enlarges the last one. */
const MIN_ZOOM = 12;
const MAX_ZOOM = 14;

/** What is kept of each point, as the archive's metadata describes it. */
const FIELDS = {
  kind: 'String',
  name: 'String',
  where: 'String',
  hours: 'String',
  access: 'String',
  type: 'String',
} as const;

/** The kinds of aid point, and the OpenStreetMap tag each is mapped with. */
const KINDS = {
  defibrillator: ['emergency', 'defibrillator'],
  fire_hydrant: ['emergency', 'fire_hydrant'],
  drinking_water: ['amenity', 'drinking_water'],
} as const;
type AidKind = keyof typeof KINDS;

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>';

interface OverpassElement {
  readonly type: string;
  readonly id: number;
  readonly lat?: number;
  readonly lon?: number;
  readonly center?: { readonly lat: number; readonly lon: number };
  readonly tags?: Readonly<Record<string, string>>;
}

/** The areas asked for one by one, `CELL_DEGREES` wide and high, as south, west, north, east. */
function cells([west, south, east, north]: Bounds): string[] {
  const all: string[] = [];
  for (let lon = west; lon < east; lon += CELL_DEGREES) {
    for (let lat = south; lat < north; lat += CELL_DEGREES) {
      const corners = [
        lat,
        lon,
        Math.min(lat + CELL_DEGREES, north),
        Math.min(lon + CELL_DEGREES, east),
      ];
      all.push(corners.map((value) => value.toFixed(4)).join(','));
    }
  }
  return all;
}

function query(cell: string): string {
  const parts = Object.values(KINDS).map(([key, value]) => `nwr["${key}"="${value}"](${cell});`);
  return `[out:json][timeout:600];(${parts.join('')});out center tags qt;`;
}

export function kindOf(tags: Readonly<Record<string, string>>): AidKind | null {
  for (const [kind, [key, value]] of Object.entries(KINDS)) {
    if (tags[key] === value) return kind as AidKind;
  }
  return null;
}

/** A point of OpenStreetMap as the archive keeps it, or null if it is none of the kinds. */
export function aidPoint(element: OverpassElement): Feature<Point> | null {
  const tags = element.tags ?? {};
  const kind = kindOf(tags);
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (kind === null || lat === undefined || lon === undefined) return null;
  const kept: Record<string, string> = { kind };
  const keep = (name: keyof typeof FIELDS, value: string | undefined) => {
    if (value !== undefined && value.trim() !== '') kept[name] = value.trim();
  };
  keep('name', tags['name']);
  keep('where', tags['defibrillator:location'] ?? tags['description']);
  keep('hours', tags['opening_hours']);
  keep('access', tags['access']);
  keep('type', tags['fire_hydrant:type']);
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: kept,
  };
}

/** Asks each instance of Overpass in turn until one answers. */
async function overpass(query: string): Promise<unknown> {
  let failure: unknown = null;
  for (const url of OVERPASS) {
    try {
      return await fetchJson(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Tesel (https://tesel.eu) aid points, weekly',
        },
        body: new URLSearchParams({ data: query }),
      });
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

async function cellPoints(cell: string): Promise<Feature<Point>[]> {
  const answer = await attempt(() => overpass(query(cell)), FIRST_WAIT_MS);
  const elements = (answer as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) throw new Error(`Overpass answered no elements for ${cell}`);
  return (elements as OverpassElement[]).flatMap((element) => aidPoint(element) ?? []);
}

async function build(bounds: Bounds, out: string): Promise<void> {
  const points: Feature<Point>[] = [];
  const seen = new Set<string>();
  const all = cells(bounds);
  for (const [index, cell] of all.entries()) {
    for (const point of await cellPoints(cell)) {
      // A point on the edge between two cells comes in both.
      const key = point.geometry.coordinates.join(',') + String(point.properties?.['kind']);
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(point);
    }
    process.stdout.write(
      `${String(index + 1)}/${String(all.length)}: ${String(points.length)} points\n`,
    );
  }
  const counts = Object.fromEntries(
    Object.keys(KINDS).map((kind) => [
      kind,
      points.filter((p) => p.properties?.['kind'] === kind).length,
    ]),
  );
  const collection: FeatureCollection = { type: 'FeatureCollection', features: points };
  const tiles = await writeLayerArchive(out, collection, {
    layer: AID_LAYER,
    fields: FIELDS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    bounds,
    metadata: {
      name: 'Tesel aid points',
      description: 'Defibrillators, fire hydrants and drinking water of OpenStreetMap',
      attribution: ATTRIBUTION,
      'tesel:counts': counts,
      'tesel:built': new Date().toISOString(),
    },
  });
  process.stdout.write(`Aid points ready: ${JSON.stringify(counts)} in ${String(tiles)} tiles\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { bbox: { type: 'string' }, out: { type: 'string' } } });
  if (values.bbox === undefined || values.out === undefined) {
    throw new Error('usage: build-aid-points.ts --bbox=WEST,SOUTH,EAST,NORTH --out=FILE');
  }
  await build(parseBounds(values.bbox), values.out);
}

if (process.argv[1]?.endsWith('build-aid-points.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
