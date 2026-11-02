// The official weather warnings a server publishes (docs/protocol.md §8.2), as the app uses them:
// the regions still under some warning, which of them hold a point, who issued them, and how each
// level looks.

import { highestLevel } from '@tesel/protocol';
import type {
  LatLon,
  RegionGeometry,
  WarningLevel,
  WarningRegion,
  WarningText,
  WeatherWarning,
  WeatherWarnings,
} from '@tesel/protocol';
import type { FeatureCollection } from 'geojson';

import type { Locale, MessageKey } from '../i18n/index.ts';
import { insideRing } from '../map/geometry.ts';
import { containsPoint, type Bounds } from '../map/tiles/math.ts';
import type { Tone } from '../ui/theme.ts';

/** How each level is named and coloured: yellow, orange, red. */
export const WARNING_LOOKS: Readonly<Record<WarningLevel, { label: MessageKey; tone: Tone }>> = {
  2: { label: 'warningYellow', tone: 'amber' },
  3: { label: 'warningOrange', tone: 'orange' },
  4: { label: 'warningRed', tone: 'red' },
};

/** A national weather service, named and linked wherever its warnings are shown. */
interface WarningIssuer {
  readonly name: string;
  readonly url: string;
}

/**
 * The services of the countries a server gathers by default (ADR-0030), by the country code that
 * begins each region's MeteoAlarm code (EMMA_ID): "ES521" is AEMET's. A country added to a server
 * needs its service here; until then its warnings are credited to MeteoAlarm alone.
 */
const ISSUERS: Readonly<Record<string, WarningIssuer>> = {
  ES: { name: 'AEMET', url: 'https://www.aemet.es' },
  PT: { name: 'IPMA', url: 'https://www.ipma.pt' },
};

/** Where the server gathers every warning from (ADR-0030), which its `source` names. */
export const METEOALARM_URL = 'https://meteoalarm.org';

/** The warnings at a point, and the services that issued them. */
export interface WarningsHere {
  readonly warnings: readonly WeatherWarning[];
  readonly issuers: readonly WarningIssuer[];
}

/** A region still under warning, with its bounds to rule points out quickly. */
export interface ActiveRegion {
  readonly region: WarningRegion;
  readonly bounds: Bounds;
}

/**
 * The regions of a document with some warning that has not expired at `now` (seconds), each with
 * only those warnings and the level they make. Worked out once per document and minute, so that
 * looking up a point is cheap.
 */
export function activeRegions(document: WeatherWarnings, now: number): ActiveRegion[] {
  return document.features.flatMap((region) => {
    const warnings = region.properties.warnings.filter((warning) => warning.expires > now);
    if (warnings.length === 0) return [];
    const properties = { ...region.properties, warnings, level: highestLevel(warnings) };
    return [{ region: { ...region, properties }, bounds: boundsOf(region.geometry) }];
  });
}

/** The warnings in force or announced at a point, highest level first, and who issued them. */
export function warningsAt(regions: readonly ActiveRegion[], at: LatLon): WarningsHere {
  const holding = regions
    .filter(({ region, bounds }) => containsPoint(bounds, at) && contains(region.geometry, at))
    .map(({ region }) => region.properties);
  const issuers = holding.flatMap(({ code }) => ISSUERS[code.slice(0, 2)] ?? []);
  return {
    warnings: holding
      .flatMap(({ warnings }) => warnings)
      .sort((a, b) => b.level - a.level || a.onset - b.onset),
    issuers: [...new Set(issuers)],
  };
}

/** The regions to draw, each with its level as a `tone` the map colours (ui/theme.ts). */
export function regionFeatures(regions: readonly ActiveRegion[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: regions.map(({ region }) => ({
      type: 'Feature',
      geometry: region.geometry,
      properties: { tone: WARNING_LOOKS[region.properties.level].tone },
    })),
  };
}

/**
 * The edges of the regions to draw, with the same `tone`. Each ring is turned so that its region
 * lies on its right, outer rings clockwise and holes the other way round: a line offset to the
 * right then runs along the inside of the region, whichever way the issuer wound it.
 */
export function regionEdges(regions: readonly ActiveRegion[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: regions.map(({ region }) => ({
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: polygonsOf(region.geometry).flatMap(([outer, ...holes]) => [
          ...(outer === undefined ? [] : [turned(outer, true)]),
          ...holes.map((hole) => turned(hole, false)),
        ]),
      },
      properties: { tone: WARNING_LOOKS[region.properties.level].tone },
    })),
  };
}

/** A ring walked clockwise or not, on a map with north up. */
function turned(ring: [number, number][], clockwise: boolean): [number, number][] {
  // Twice the ring's signed area, positive when it runs anticlockwise (the shoelace formula).
  let area = 0;
  ring.forEach(([x1, y1], index) => {
    const [x2, y2] = ring[(index + 1) % ring.length] ?? [x1, y1];
    area += x1 * y2 - x2 * y1;
  });
  return area < 0 === clockwise ? ring : [...ring].reverse();
}

/** A warning's text in the app's language, or in the other one if the issuer gave only that. */
export function warningText(warning: WeatherWarning, locale: Locale): WarningText | null {
  return warning.text[locale] ?? warning.text.es ?? warning.text.en ?? null;
}

function polygonsOf(geometry: RegionGeometry): [number, number][][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function boundsOf(geometry: RegionGeometry): Bounds {
  const polygons = polygonsOf(geometry);
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) {
    // The outer ring holds the rest.
    for (const [lon, lat] of polygon[0] ?? []) {
      west = Math.min(west, lon);
      south = Math.min(south, lat);
      east = Math.max(east, lon);
      north = Math.max(north, lat);
    }
  }
  return { west, south, east, north };
}

/** Whether a point is inside a polygon or multipolygon, holes left out. */
export function contains(geometry: RegionGeometry, at: LatLon): boolean {
  return polygonsOf(geometry).some(
    ([outer, ...holes]) =>
      outer !== undefined && insideRing(outer, at) && !holes.some((hole) => insideRing(hole, at)),
  );
}
