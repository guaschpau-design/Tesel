import { describe, expect, it } from 'vitest';

import { tileIdToZxy } from 'pmtiles';

import { BUILDINGS_MAX_ZOOM, BUILDINGS_MIN_ZOOM, parseBounds, tilesOf } from './buildings-area.ts';

describe('the area of the buildings archive', () => {
  it('reads bounds as west, south, east, north', () => {
    expect(parseBounds('-18.4,27.4,4.6,44')).toEqual([-18.4, 27.4, 4.6, 44]);
    expect(() => parseBounds('4.6,27.4,-18.4,44')).toThrow();
    expect(() => parseBounds('1,2,3')).toThrow();
  });

  it('lists its tiles at the zooms built, in the order of their IDs', () => {
    // Roques Planes: one tile at zoom 13, a few at zoom 14.
    const tiles = tilesOf([1.38, 41.14, 1.41, 41.16]);
    expect(new Set(tiles.map((tile) => tile.z))).toEqual(
      new Set([BUILDINGS_MIN_ZOOM, BUILDINGS_MAX_ZOOM]),
    );
    const ids = tiles.map((tile) => tile.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    for (const { z, x, y, id } of tiles) expect(tileIdToZxy(id)).toEqual([z, x, y]);
    expect(tiles.some(({ z, x, y }) => z === 14 && x === 8255 && y === 6133)).toBe(true);
  });
});
