import { describe, expect, it } from 'vitest';

import { FRANCE_SOUTH, PORTUGAL, SPAIN } from '../tiles/borders-data.ts';
import { osmBuildingsHidden } from './one-layer-of-buildings.ts';

const OUTLINES = { spain: SPAIN, others: [PORTUGAL, FRANCE_SOUTH] };

/** A view of about a kilometre round a place. */
function around(lat: number, lon: number) {
  const half = 0.006;
  return { west: lon - half, south: lat - half, east: lon + half, north: lat + half };
}

describe('one layer of buildings', () => {
  it('hides OpenStreetMap’s buildings in Spain, inland as on the coast', () => {
    expect(osmBuildingsHidden(around(41.155, 1.107), OUTLINES)).toBe(true); // Reus
    expect(osmBuildingsHidden(around(39.469, -0.322), OUTLINES)).toBe(true); // Valencia's beach
  });

  it('keeps them elsewhere, and where a view reaches another country', () => {
    expect(osmBuildingsHidden(around(38.722, -9.139), OUTLINES)).toBe(false); // Lisbon
    expect(osmBuildingsHidden(around(43.6, 1.44), OUTLINES)).toBe(false); // Toulouse
    expect(osmBuildingsHidden(around(43.343, -1.79), OUTLINES)).toBe(false); // Irun and Hendaye
  });
});
