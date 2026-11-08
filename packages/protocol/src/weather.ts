// Weather warnings as a server publishes them (docs/protocol.md §8.2): a GeoJSON collection of
// warning regions. The server builds it with these types; clients read it with
// `parseWeatherWarnings`, which keeps only what is well formed.

import { FLOOD_ZONES_PATH, WEATHER_WARNINGS_PATH } from './constants.ts';
import { serverBaseUrl } from './relay.ts';

/** §8.2 levels: yellow, orange and red (MeteoAlarm awareness levels). */
export type WarningLevel = 2 | 3 | 4;
export const WARNING_LEVELS: readonly WarningLevel[] = [2, 3, 4];

/** The languages warnings are given in, as the app speaks them. */
export type WarningLanguage = 'es' | 'en';

export interface WarningText {
  readonly event: string;
  readonly description: string;
}

export interface WeatherWarning {
  readonly level: WarningLevel;
  /** Seconds since the epoch. */
  readonly onset: number;
  readonly expires: number;
  readonly text: Readonly<Partial<Record<WarningLanguage, WarningText>>>;
}

/** A region's outline, as GeoJSON writes it: rings of [lon, lat] positions. */
export type RegionGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: [number, number][][] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: [number, number][][][] };

export interface WarningRegion {
  readonly type: 'Feature';
  readonly geometry: RegionGeometry;
  readonly properties: {
    readonly code: string;
    readonly name: string;
    /** The highest level among its warnings. */
    readonly level: WarningLevel;
    readonly warnings: readonly WeatherWarning[];
  };
}

export interface WeatherWarnings {
  readonly type: 'FeatureCollection';
  readonly tesel: typeof WEATHER_WARNINGS_KIND;
  readonly version: typeof WEATHER_WARNINGS_VERSION;
  /** Seconds since the epoch when the server last gathered them. */
  readonly updated: number;
  /** Who issues the warnings, to be credited. */
  readonly source: string;
  readonly features: readonly WarningRegion[];
}

export const WEATHER_WARNINGS_KIND = 'weather-warnings';
export const WEATHER_WARNINGS_VERSION = 1;

/** §8.2 The URL of a server's weather warnings. */
export function weatherWarningsUrl(server: string): string {
  return new URL(WEATHER_WARNINGS_PATH, serverBaseUrl(server)).href;
}

/** §8.3 Where a server draws the flood zones of a view. */
export function floodZonesUrl(server: string): string {
  return new URL(FLOOD_ZONES_PATH, serverBaseUrl(server)).href;
}

/** Reads a server's answer; null if it is not a weather warnings document of this version. */
export function parseWeatherWarnings(value: unknown): WeatherWarnings | null {
  if (!isRecord(value)) return null;
  const { tesel, version, updated, source, features } = value;
  if (tesel !== WEATHER_WARNINGS_KIND || version !== WEATHER_WARNINGS_VERSION) return null;
  if (typeof updated !== 'number' || typeof source !== 'string' || !Array.isArray(features)) {
    return null;
  }
  return {
    type: 'FeatureCollection',
    tesel,
    version,
    updated,
    source,
    features: features.flatMap((feature) => {
      const region = parseRegion(feature);
      return region === null ? [] : [region];
    }),
  };
}

function parseRegion(value: unknown): WarningRegion | null {
  if (!isRecord(value) || !isRecord(value['properties'])) return null;
  const geometry = parseGeometry(value['geometry']);
  const { code, name, warnings } = value['properties'];
  if (geometry === null || typeof code !== 'string' || typeof name !== 'string') return null;
  if (!Array.isArray(warnings)) return null;
  const parsed = warnings.flatMap((warning) => {
    const item = parseWarning(warning);
    return item === null ? [] : [item];
  });
  if (parsed.length === 0) return null;
  return {
    type: 'Feature',
    geometry,
    properties: { code, name, level: highestLevel(parsed), warnings: parsed },
  };
}

function parseGeometry(value: unknown): RegionGeometry | null {
  if (!isRecord(value)) return null;
  const { type, coordinates } = value;
  if (type === 'Polygon' && isPolygon(coordinates)) return { type, coordinates };
  if (type === 'MultiPolygon' && Array.isArray(coordinates) && coordinates.every(isPolygon)) {
    return { type, coordinates };
  }
  return null;
}

/** Rings of [lon, lat] positions. */
function isPolygon(value: unknown): value is [number, number][][] {
  return (
    Array.isArray(value) &&
    value.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.every(
          (position) =>
            Array.isArray(position) &&
            typeof position[0] === 'number' &&
            typeof position[1] === 'number',
        ),
    )
  );
}

function parseWarning(value: unknown): WeatherWarning | null {
  if (!isRecord(value) || !isRecord(value['text'])) return null;
  const { level, onset, expires } = value;
  if (!WARNING_LEVELS.includes(level as WarningLevel)) return null;
  if (typeof onset !== 'number' || typeof expires !== 'number') return null;
  const text: Partial<Record<WarningLanguage, WarningText>> = {};
  for (const language of ['es', 'en'] as const) {
    const entry = value['text'][language];
    if (isRecord(entry) && typeof entry['event'] === 'string') {
      const description = entry['description'];
      text[language] = {
        event: entry['event'],
        description: typeof description === 'string' ? description : '',
      };
    }
  }
  return { level: level as WarningLevel, onset, expires, text };
}

/** The highest level of some warnings; yellow when there are none. */
export function highestLevel(warnings: readonly WeatherWarning[]): WarningLevel {
  return warnings.reduce<WarningLevel>(
    (top, warning) => Math.max(top, warning.level) as WarningLevel,
    2,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
