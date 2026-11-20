import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';

import { buildingFacts, floorsOf, type BuildingPiece } from './building.ts';

const CORNER: LatLon = { lat: 39.47, lon: -0.37 };

/** A square `side` metres across, its south-west corner `east` metres east of the corner. */
function square(side: number, east = 0): Polygon['coordinates'] {
  const at = (north: number, eastward: number) => {
    const point = offsetMeters(CORNER, north, east + eastward);
    return [point.lon, point.lat];
  };
  return [[at(0, 0), at(0, side), at(side, side), at(side, 0), at(0, 0)]];
}

function piece(rings: Polygon['coordinates'], height: number | null = 23): BuildingPiece {
  return { rings, height, number: null };
}

describe('what is known of a building', () => {
  it('reckons its floors from its height as the base map does', () => {
    expect(floorsOf(23)).toBe(7);
    expect(floorsOf(5)).toBe(1);
    expect(floorsOf(2)).toBe(1);
  });

  it('tells its height, floors and the ground it covers', () => {
    const facts = buildingFacts([piece(square(20))], true, []);
    expect(facts.height).toBe(23);
    expect(facts.floors).toBe(7);
    expect(facts.footprint).toBeCloseTo(400, -1);
  });

  it('adds up the ground its polygons cover, and tells none when the tile cuts it', () => {
    const pieces = [piece(square(20)), piece(square(20, 40))];
    expect(buildingFacts(pieces, true, []).footprint).toBeCloseTo(800, -1);
    expect(buildingFacts(pieces, false, []).footprint).toBeNull();
  });

  it('tells nothing of a height it does not know', () => {
    const facts = buildingFacts([piece(square(20), null)], true, []);
    expect(facts.height).toBeNull();
    expect(facts.floors).toBeNull();
  });

  it('takes the house numbers on its outline, in order, and not those across the street', () => {
    const numbers = [
      { ref: '14', at: offsetMeters(CORNER, -3, 10) },
      { ref: '12', at: offsetMeters(CORNER, 10, 10) },
      { ref: '15', at: offsetMeters(CORNER, -25, 10) },
    ];
    const facts = buildingFacts([{ ...piece(square(20)), number: '2' }], true, numbers);
    expect(facts.numbers).toEqual(['2', '12', '14']);
  });
});
