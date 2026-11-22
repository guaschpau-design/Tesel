import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import type { TileArchive } from '../map/tiles/sources.ts';
import { countTiles, tilesInBounds } from '../map/tiles/math.ts';
import type { TileArchives } from '../map/tiles/protocol.ts';
import { openTileStore } from '../map/tiles/store.ts';
import { keepOverview, overviewZoom } from './overview.ts';

/** What the map our servers publish covers: Spain and Portugal (deploy/vps/maps.sh). */
const IBERIA = { west: -18.4, south: 27.4, east: 4.6, north: 44.0 };
const WORLD = { west: -180, south: -85, east: 180, north: 85 };

let databases = 0;

function archivesFor(bounds: typeof IBERIA, asked: string[]): TileArchives {
  const archive: TileArchive = {
    getTile: (z, x, y) => {
      asked.push(`${String(z)}/${String(x)}/${String(y)}`);
      return Promise.resolve(new Uint8Array([z, x, y]).buffer);
    },
  };
  return {
    basemap: { ...archive, bounds: () => Promise.resolve(bounds) },
    buildings: archive,
    'aid-points': archive,
    'ign-names': archive,
    ortho: archive,
    terrain: archive,
  };
}

describe('the overview of the base map', () => {
  it('goes to zoom 6 over Spain and Portugal, and less deep over the world', () => {
    expect(overviewZoom(IBERIA)).toBe(6);
    expect(countTiles(IBERIA, 0, 6)).toBe(42);
    expect(overviewZoom(WORLD)).toBe(3);
  });

  it('is kept once, apart from the areas, whatever is deleted', async () => {
    const store = await openTileStore(`overview-${String(++databases)}`);
    const asked: string[] = [];
    await keepOverview(store, archivesFor(IBERIA, asked));
    expect(asked).toHaveLength(42);
    for (const tile of tilesInBounds(IBERIA, 0, 6)) {
      expect(await store.getTile('basemap', tile)).toBeDefined();
    }
    expect(await store.listAreas()).toEqual([]);

    // A start of the app later, online again: nothing is missing, nothing is asked for.
    await keepOverview(store, archivesFor(IBERIA, asked));
    expect(asked).toHaveLength(42);
  });

  it('gives up quietly without a connection', async () => {
    const store = await openTileStore(`overview-${String(++databases)}`);
    const offline: TileArchives = {
      ...archivesFor(IBERIA, []),
      basemap: {
        getTile: () => Promise.reject(new TypeError('Failed to fetch')),
        bounds: () => Promise.reject(new TypeError('Failed to fetch')),
      },
    };
    await expect(keepOverview(store, offline)).resolves.toBeUndefined();
  });
});
