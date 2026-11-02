import type {
  RegionGeometry,
  WarningRegion,
  WeatherWarning,
  WeatherWarnings,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  activeRegions,
  contains,
  regionEdges,
  regionFeatures,
  warningsAt,
  warningText,
} from './weather-warnings.ts';

const NOW = 1_793_000_000;

const warning = (level: 2 | 3 | 4, expires: number): WeatherWarning => ({
  level,
  onset: NOW - 3600,
  expires,
  text: { es: { event: 'Lluvias', description: '80 mm' }, en: { event: 'Rain', description: '' } },
});

const square: [number, number][] = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
];
const hole: [number, number][] = [
  [0.5, 0.5],
  [1.5, 0.5],
  [1.5, 1.5],
  [0.5, 1.5],
  [0.5, 0.5],
];

const region = (code: string, warnings: WeatherWarning[]): WarningRegion => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [square] },
  properties: { code, name: code, level: 4, warnings },
});

const document = (...features: WarningRegion[]): WeatherWarnings => ({
  type: 'FeatureCollection',
  tesel: 'weather-warnings',
  version: 1,
  updated: NOW,
  source: 'MeteoAlarm',
  features,
});

describe('weather warnings', () => {
  it('keeps the warnings not expired yet, and the level they make', () => {
    const regions = activeRegions(
      document(
        region('A', [warning(4, NOW - 1), warning(2, NOW + 60)]),
        region('B', [warning(3, NOW - 1)]),
      ),
      NOW,
    );
    expect(regions.map(({ region }) => region.properties)).toMatchObject([{ code: 'A', level: 2 }]);
    expect(regionFeatures(regions).features[0]?.properties).toEqual({ tone: 'amber' });
  });

  it('finds the warnings at a point, highest level first', () => {
    const regions = activeRegions(
      document(region('A', [warning(2, NOW + 60)]), region('B', [warning(4, NOW + 60)])),
      NOW,
    );
    expect(warningsAt(regions, { lat: 1, lon: 1 }).warnings.map((w) => w.level)).toEqual([4, 2]);
    expect(warningsAt(regions, { lat: 3, lon: 1 }).warnings).toEqual([]);
  });

  it('names the national services that issued the warnings at a point, once each', () => {
    const regions = activeRegions(
      document(
        region('ES521', [warning(2, NOW + 60)]),
        region('ES522', [warning(3, NOW + 60)]),
        region('PT004', [warning(2, NOW + 60)]),
        region('FR801', [warning(2, NOW + 60)]),
      ),
      NOW,
    );
    expect(warningsAt(regions, { lat: 1, lon: 1 }).issuers.map(({ name }) => name)).toEqual([
      'AEMET',
      'IPMA',
    ]);
    expect(warningsAt(regions, { lat: 3, lon: 1 }).issuers).toEqual([]);
  });

  it('tells whether a point is inside an outline, holes left out', () => {
    const holed: RegionGeometry = { type: 'Polygon', coordinates: [square, hole] };
    expect(contains(holed, { lat: 0.2, lon: 0.2 })).toBe(true);
    expect(contains(holed, { lat: 1, lon: 1 })).toBe(false);
    const multi: RegionGeometry = { type: 'MultiPolygon', coordinates: [[hole], [square]] };
    expect(contains(multi, { lat: 1.8, lon: 1.8 })).toBe(true);
  });

  it('turns each edge so that its region lies on its right', () => {
    const holed = activeRegions(
      document({
        ...region('A', [warning(3, NOW + 60)]),
        geometry: { type: 'Polygon', coordinates: [square, hole] },
      }),
      NOW,
    );
    // The outer ring, given anticlockwise, is walked clockwise; the hole, anticlockwise, is kept.
    expect(regionEdges(holed).features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: [[...square].reverse(), hole] },
      properties: { tone: 'orange' },
    });
    const clockwise = [...square].reverse();
    const multi = activeRegions(
      document({
        ...region('B', [warning(2, NOW + 60)]),
        geometry: { type: 'MultiPolygon', coordinates: [[clockwise], [[...hole].reverse()]] },
      }),
      NOW,
    );
    expect(regionEdges(multi).features[0]?.geometry).toEqual({
      type: 'MultiLineString',
      coordinates: [clockwise, [...hole].reverse()],
    });
  });

  it('gives the text in the app’s language, or in the other one', () => {
    const both = warning(3, NOW + 60);
    const spanish = { event: 'Lluvias', description: '80 mm' };
    expect(warningText(both, 'en')?.event).toBe('Rain');
    expect(warningText({ ...both, text: { es: spanish } }, 'en')?.event).toBe('Lluvias');
    expect(warningText({ ...both, text: {} }, 'es')).toBeNull();
  });
});
