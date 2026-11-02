import { describe, expect, it } from 'vitest';

import {
  boundsAround,
  containsBounds,
  isOnEarth,
  countTiles,
  positionInTile,
  tileAt,
  tileKey,
  tilesInBounds,
} from './math.ts';

const valencia = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };

describe('tile arithmetic', () => {
  it('places Madrid in the right zoom-10 tile', () => {
    expect(tileAt({ lat: 40.4168, lon: -3.7038 }, 10).tile).toEqual({ z: 10, x: 501, y: 386 });
  });

  it('places a point within its tile, from 0 to 1 across and down', () => {
    const { tile, u, v } = tileAt({ lat: 0, lon: 0 }, 1);
    expect(tile).toEqual({ z: 1, x: 1, y: 1 });
    expect([u, v]).toEqual([0, 0]);
    expect(positionInTile([0, 0], { z: 1, x: 0, y: 0 })).toEqual([1, 1]);
  });

  it('clamps coordinates at the edges of the world', () => {
    expect(tileAt({ lat: 90, lon: 180 }, 3).tile).toEqual({ z: 3, x: 7, y: 0 });
    expect(tileAt({ lat: -90, lon: -180 }, 3).tile).toEqual({ z: 3, x: 0, y: 7 });
  });

  it('counts exactly the tiles it lists', () => {
    expect(countTiles(valencia, 0, 14)).toBe([...tilesInBounds(valencia, 0, 14)].length);
  });

  it('includes one tile per lower zoom level for a small area', () => {
    const keys = [...tilesInBounds(valencia, 0, 3)].map(tileKey);
    expect(keys).toEqual(['0/0/0', '1/0/0', '2/1/1', '3/3/3']);
  });

  it('grows roughly fourfold per zoom level', () => {
    const at13 = countTiles(valencia, 13, 13);
    const at14 = countTiles(valencia, 14, 14);
    expect(at14 / at13).toBeGreaterThan(3);
    expect(at14 / at13).toBeLessThan(5);
  });
});

describe('bounds', () => {
  it('wraps a set of points', () => {
    const points = [
      { lat: 39.44, lon: -0.33 },
      { lat: 39.5, lon: -0.42 },
      { lat: 39.47, lon: -0.4 },
    ];
    expect(boundsAround(points)).toEqual(valencia);
  });

  it('takes points beyond the world’s edges to the edge', () => {
    const bounds = boundsAround([
      { lat: 94, lon: -200 },
      { lat: -95, lon: 190 },
    ]);
    expect(bounds).toEqual({ west: -180, south: -90, east: 180, north: 90 });
    expect(isOnEarth(bounds)).toBe(true);
  });

  it('tells bounds that are no place on the Earth', () => {
    expect(isOnEarth(valencia)).toBe(true);
    expect(isOnEarth(boundsAround([{ lat: Number.NaN, lon: 0 }]))).toBe(false);
    expect(isOnEarth(boundsAround([]))).toBe(false);
    expect(isOnEarth({ ...valencia, north: 91 })).toBe(false);
  });

  it('tells whether one area holds another', () => {
    expect(containsBounds(valencia, { west: -0.4, south: 39.45, east: -0.35, north: 39.49 })).toBe(
      true,
    );
    expect(containsBounds(valencia, { ...valencia, east: -0.3 })).toBe(false);
  });
});
