import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';

import { buildingFacts, kindOf, sourceOf, type ArchivedBuilding } from './building.ts';

const CORNER: LatLon = { lat: 39.47, lon: -0.37 };

/** A square `side` metres across, its south-west corner `east` metres east of the corner. */
function square(side: number, east = 0): Polygon['coordinates'] {
  const at = (north: number, eastward: number) => {
    const point = offsetMeters(CORNER, north, east + eastward);
    return [point.lon, point.lat];
  };
  return [[at(0, 0), at(0, side), at(side, side), at(side, 0), at(0, 0)]];
}

function building(overrides: Partial<ArchivedBuilding> = {}): ArchivedBuilding {
  return {
    polygons: [square(20)],
    height: 23,
    floors: 7,
    class: 'apartments',
    source: 'OpenStreetMap',
    ...overrides,
  };
}

describe('what is known of a building', () => {
  it('tells its floors and height, its use, its outline and the ground it covers', () => {
    const facts = buildingFacts(building(), true, []);
    expect(facts.floors).toEqual({ count: 7, known: true });
    expect(facts.height).toBe(23);
    expect(facts.kind).toBe('homes');
    expect(facts.source).toEqual({ kind: 'osm' });
    expect(facts.footprint).toBeCloseTo(400, -1);
  });

  it('reckons its floors from its height where they are not known', () => {
    expect(buildingFacts(building({ floors: null, height: 12 }), true, []).floors).toEqual({
      count: 4,
      known: false,
    });
    expect(buildingFacts(building({ floors: null, height: null }), true, []).floors).toBeNull();
  });

  it('adds up the ground of its polygons, and tells none when the tile cuts it', () => {
    const parts = building({ polygons: [square(20), square(20, 40)] });
    expect(buildingFacts(parts, true, []).footprint).toBeCloseTo(800, -1);
    expect(buildingFacts(parts, false, []).footprint).toBeNull();
  });

  it('takes the house numbers on its outline, in order, and not those across the street', () => {
    const numbers = [
      { ref: '14', at: offsetMeters(CORNER, -3, 10) },
      { ref: '2', at: offsetMeters(CORNER, 10, 10) },
      { ref: '15', at: offsetMeters(CORNER, -25, 10) },
    ];
    expect(buildingFacts(building(), true, numbers).numbers).toEqual(['2', '14']);
  });

  it('knows a few uses, and where outlines come from', () => {
    expect(kindOf('warehouse')).toBe('industry');
    expect(kindOf('yes')).toBeNull();
    expect(sourceOf('Instituto Geográfico Nacional (España)')).toEqual({ kind: 'national' });
    expect(sourceOf('Microsoft ML Buildings')).toEqual({ kind: 'imagery' });
    expect(sourceOf('Google Open Buildings')).toEqual({ kind: 'imagery' });
    expect(sourceOf('Esri Community Maps')).toEqual({ kind: 'other', name: 'Esri Community Maps' });
  });
});
