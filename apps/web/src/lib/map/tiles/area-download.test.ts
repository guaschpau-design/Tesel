import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import {
  downloadArea,
  MAX_AREA_TILES,
  SourceUnreachable,
  type AreaRequest,
} from './area-download.ts';
import { countTiles, tileKey, tilesInBounds } from './math.ts';
import type { TileArchive } from './sources.ts';
import { openTileStore, type TileStore } from './store.ts';

let dbCounter = 0;
const freshStore = () => openTileStore(`download-${String(dbCounter++)}`);
const bounds = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };

/** Every tile exists except those with an odd x at zoom 12, which play "open sea". */
const fakeArchive: TileArchive = {
  getTile: (z, x, y) =>
    Promise.resolve(
      z === 12 && x % 2 === 1 ? undefined : new Uint8Array([z, x & 255, y & 255]).buffer,
    ),
};

describe('area download', () => {
  it('stores every non-empty tile and reports progress to the end', async () => {
    const store = await freshStore();
    const progress: number[] = [];
    const area = await downloadArea(store, {
      id: 'v',
      name: 'Valencia',
      bounds,
      layers: [
        { source: 'basemap', archive: fakeArchive, maxZoom: 12, concurrency: 6 },
        { source: 'ortho', archive: fakeArchive, maxZoom: 10, concurrency: 2 },
      ],
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p.done),
      createdAt: 1000,
    });

    const total = countTiles(bounds, 0, 12) + countTiles(bounds, 0, 10);
    expect(progress.at(-1)).toBe(total);
    expect(area.complete).toBe(true);
    for (const tile of tilesInBounds(bounds, 0, 12)) {
      const stored = await store.getTile('basemap', tile);
      expect(stored === undefined).toBe(tile.z === 12 && tile.x % 2 === 1);
    }
    for (const tile of tilesInBounds(bounds, 0, 10)) {
      expect(await store.getTile('ortho', tile)).toBeDefined();
    }
    expect(await store.listAreas()).toEqual([area]);
  });

  it('leaves an incomplete area behind when cancelled', async () => {
    const store = await freshStore();
    const controller = new AbortController();
    const promise = downloadArea(store, {
      id: 'c',
      name: 'Cancelled',
      bounds,
      layers: [{ source: 'basemap', archive: fakeArchive, maxZoom: 13, concurrency: 6 }],
      signal: controller.signal,
      onProgress: (p) => {
        if (p.done === 5) controller.abort();
      },
      createdAt: 1000,
    });
    await expect(promise).rejects.toThrow();
    const [area] = await store.listAreas();
    expect(area?.complete).toBe(false);
  });

  it('refuses areas larger than the limit', async () => {
    const store = await freshStore();
    const huge = { west: -10, south: 36, east: 4, north: 44 };
    expect(countTiles(huge, 0, 14)).toBeGreaterThan(MAX_AREA_TILES);
    await expect(
      downloadArea(store, {
        id: 'h',
        name: 'Iberia',
        bounds: huge,
        layers: [{ source: 'basemap', archive: fakeArchive, maxZoom: 14, concurrency: 6 }],
        signal: new AbortController().signal,
        createdAt: 1000,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('tries a failing tile again, and stores it once it comes', async () => {
    const store = await freshStore();
    const tries = new Map<string, number>();
    const flaky: TileArchive = {
      getTile: (z, x, y, signal) => {
        const key = tileKey({ z, x, y });
        const count = (tries.get(key) ?? 0) + 1;
        tries.set(key, count);
        return count < 3 ? Promise.reject(new Error('503')) : fakeArchive.getTile(z, x, y, signal);
      },
    };
    const area = await downloadArea(store, valencia(flaky));
    expect(area.complete).toBe(true);
    expect(await store.getTile('basemap', { z: 0, x: 0, y: 0 })).toBeDefined();
  });

  it('leaves out a tile that never comes, and fetches only what is missing when resumed', async () => {
    const store = await freshStore();
    const lost = tileKey({ z: 0, x: 0, y: 0 });
    const oneLost: TileArchive = {
      getTile: (z, x, y, signal) =>
        tileKey({ z, x, y }) === lost
          ? Promise.reject(new Error('503'))
          : fakeArchive.getTile(z, x, y, signal),
    };
    const first = await downloadArea(store, valencia(oneLost));
    expect(first.complete).toBe(false);
    expect(await store.listAreas()).toEqual([first]);

    const asked: string[] = [];
    const counting: TileArchive = {
      getTile: (z, x, y, signal) => {
        asked.push(tileKey({ z, x, y }));
        return fakeArchive.getTile(z, x, y, signal);
      },
    };
    const resumed = await downloadArea(store, valencia(counting));
    expect(resumed.complete).toBe(true);
    expect(asked).toEqual([lost]);
    expect(resumed.storedTiles).toBe(countTiles(bounds, 0, 10));
  });

  it('stops when tile after tile fails, and reports nothing after it has stopped', async () => {
    const store = await freshStore();
    const down: TileArchive = { getTile: () => Promise.reject(new Error('offline')) };
    let reports = 0;
    const download = downloadArea(store, {
      ...valencia(down),
      onProgress: () => {
        reports++;
      },
    });
    await expect(download).rejects.toThrow(SourceUnreachable);
    const settled = reports;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reports).toBe(settled);
    const [area] = await store.listAreas();
    expect(area?.complete).toBe(false);
  });

  it('stops every request when the store refuses a write', async () => {
    const store = await freshStore();
    const full: TileStore = {
      getTile: (source, tile) => store.getTile(source, tile),
      putTiles: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
      keepStored: (owner, source, tiles) => store.keepStored(owner, source, tiles),
      countStored: (source, tiles) => store.countStored(source, tiles),
      keepViewed: (source, tile, data) => store.keepViewed(source, tile, data),
      saveArea: (area) => store.saveArea(area),
      listAreas: () => store.listAreas(),
      deleteArea: (area) => store.deleteArea(area),
    };
    let requests = 0;
    const counting: TileArchive = {
      getTile: (z, x, y, signal) => {
        requests++;
        return fakeArchive.getTile(z, x, y, signal);
      },
    };
    await expect(
      downloadArea(full, { ...valencia(counting), layers: [layer(counting, 16)] }),
    ).rejects.toThrow('full');
    const settled = requests;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toBe(settled);
    expect(settled).toBeLessThan(countTiles(bounds, 0, 16));
  });
});

function layer(archive: TileArchive, maxZoom: number) {
  return { source: 'basemap' as const, archive, maxZoom, concurrency: 6 };
}

/** The street map of Valencia to zoom 10, with no waiting between tries. */
function valencia(archive: TileArchive): AreaRequest {
  return {
    id: 'v',
    name: 'Valencia',
    bounds,
    layers: [layer(archive, 10)],
    signal: new AbortController().signal,
    createdAt: 1000,
    wait: () => Promise.resolve(),
  };
}
