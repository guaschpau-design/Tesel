import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

import { tilesInBounds, type Bounds, type TileCoord } from './math.ts';
import { openTileStore } from './store.ts';
import type { OfflineArea } from './store-schema.ts';

let dbCounter = 0;
const freshStore = () => openTileStore(`test-${String(dbCounter++)}`);

function area(id: string, bounds: Bounds): OfflineArea {
  return {
    id,
    name: id,
    bounds,
    minZoom: 10,
    layers: [{ source: 'basemap', maxZoom: 12 }],
    storedTiles: 0,
    bytes: 0,
    createdAt: Date.now(),
    complete: true,
  };
}

const tilesOf = (a: OfflineArea) =>
  [...tilesInBounds(a.bounds, a.minZoom, 12)].map((tile) => ({
    tile,
    data: new Uint8Array([tile.z, tile.x % 256, tile.y % 256]).buffer,
  }));

describe('offline tile store', () => {
  it('returns stored tiles and nothing for unknown ones', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    await store.putTiles(a.id, 'basemap', tilesOf(a));
    const [first] = tilesOf(a);
    if (first === undefined) throw new Error('no tiles');
    const read = await store.getTile('basemap', first.tile);
    expect(new Uint8Array(read ?? new ArrayBuffer(0))).toEqual(new Uint8Array(first.data));
    expect(await store.getTile('basemap', { z: 0, x: 0, y: 0 })).toBeUndefined();
    // The same coordinates of another source are another tile.
    expect(await store.getTile('ortho', first.tile)).toBeUndefined();
  });

  it('keeps tiles shared with another area when one area is deleted', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    const b = area('b', { west: 2.15, south: 41.38, east: 2.3, north: 41.45 });
    for (const x of [a, b]) {
      await store.putTiles(x.id, 'basemap', tilesOf(x));
      await store.saveArea(x);
    }
    await store.deleteArea(a);

    for (const tile of tilesOf(b)) expect(await store.getTile('basemap', tile.tile)).toBeDefined();
    const same = (t: { tile: TileCoord }, u: { tile: TileCoord }) =>
      t.tile.z === u.tile.z && t.tile.x === u.tile.x && t.tile.y === u.tile.y;
    const onlyInA = tilesOf(a).filter((t) => !tilesOf(b).some((u) => same(t, u)));
    expect(onlyInA.length).toBeGreaterThan(0);
    for (const tile of onlyInA) expect(await store.getTile('basemap', tile.tile)).toBeUndefined();
    expect((await store.listAreas()).map((x) => x.id)).toEqual(['b']);
  });

  it('tells which tiles a new owner still needs, and keeps the others for it too', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    const stored = tilesOf(a);
    await store.putTiles(a.id, 'basemap', stored.slice(1));
    await store.saveArea(a);
    const kept = await store.keepStored(
      'overview',
      'basemap',
      stored.map(({ tile }) => tile),
    );
    expect(kept.missing).toEqual([stored[0]?.tile]);
    expect(kept.kept).toBe(stored.length - 1);
    expect(kept.bytes).toBe(3 * (stored.length - 1));
    await store.deleteArea(a);
    for (const { tile } of stored.slice(1)) {
      expect(await store.getTile('basemap', tile)).toBeDefined();
    }
  });

  it('keeps the latest tiles seen up to its room, unless an area needs them', async () => {
    const store = await freshStore();
    const seen = (x: number) => ({ z: 18, x, y: 0 });
    const data = new ArrayBuffer(600 * 1024);
    // The first tile seen is downloaded with an area afterwards: it is not the cache's to drop.
    await store.keepViewed('basemap', seen(0), data);
    await store.putTiles('a', 'basemap', [{ tile: seen(0), data }]);
    for (let x = 1; x < 128; x++) await store.keepViewed('basemap', seen(x), data);

    expect(await store.getTile('basemap', seen(0))).toBeDefined();
    expect(await store.getTile('basemap', seen(1))).toBeUndefined();
    expect(await store.getTile('basemap', seen(127))).toBeDefined();
  });

  it('forgets every tile seen to make room, and none an area needs', async () => {
    const store = await freshStore();
    const data = new Uint8Array([1]).buffer;
    const needed = { z: 18, x: 0, y: 0 };
    const seen = { z: 18, x: 1, y: 0 };
    await store.putTiles('a', 'basemap', [{ tile: needed, data }]);
    await store.keepViewed('basemap', seen, data);
    await store.forgetViewed();
    expect(await store.getTile('basemap', needed)).toBeDefined();
    expect(await store.getTile('basemap', seen)).toBeUndefined();
  });

  it('keeps the tiles and areas of the first version, as the base map’s', async () => {
    const name = `upgrade-${String(dbCounter++)}`;
    const old = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      },
    });
    await old.put('tiles', { data: new Uint8Array([7]).buffer, areas: ['v'] }, '3/4/5');
    await old.put('areas', {
      id: 'v',
      name: 'v',
      bounds: { west: 2.1, south: 41.35, east: 2.2, north: 41.42 },
      minZoom: 10,
      maxZoom: 12,
      storedTiles: 1,
      bytes: 1,
      createdAt: 0,
      complete: true,
    });
    old.close();

    const store = await openTileStore(name);
    expect(await store.getTile('basemap', { z: 3, x: 4, y: 5 })).toBeDefined();
    const [upgraded] = await store.listAreas();
    expect(upgraded?.layers).toEqual([{ source: 'basemap', maxZoom: 12 }]);
    expect(upgraded).not.toHaveProperty('maxZoom');
  });

  it('drops the scanned topographic map of the second version, and keeps the rest', async () => {
    const name = `upgrade-${String(dbCounter++)}`;
    const old = await openDB(name, 2, {
      upgrade(database) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      },
    });
    const tile = { data: new Uint8Array([7]).buffer, areas: ['v'] };
    await old.put('tiles', tile, 'basemap/3/4/5');
    await old.put('tiles', tile, 'ign-topo/3/4/5');
    await old.put('areas', {
      ...area('v', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 }),
      layers: [
        { source: 'basemap', maxZoom: 12 },
        { source: 'ign-topo', maxZoom: 15 },
      ],
    });
    old.close();

    const store = await openTileStore(name);
    expect(await store.getTile('basemap', { z: 3, x: 4, y: 5 })).toBeDefined();
    const raw = await openDB(name);
    expect(await raw.get('tiles', 'ign-topo/3/4/5')).toBeUndefined();
    raw.close();
    const [upgraded] = await store.listAreas();
    expect(upgraded?.layers).toEqual([{ source: 'basemap', maxZoom: 12 }]);
  });

  it('renames the sources of the third version, and drops the elevation of other encodings', async () => {
    const name = `upgrade-${String(dbCounter++)}`;
    const old = await openDB(name, 3, {
      upgrade(database) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      },
    });
    const tile = { data: new Uint8Array([7]).buffer, areas: ['v'] };
    for (const source of ['basemap', 'ign-contours', 'ign-ortho', 'ign-relief', 'terrain']) {
      await old.put('tiles', tile, `${source}/3/4/5`);
    }
    await old.put('areas', {
      ...area('v', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 }),
      layers: ['basemap', 'ign-contours', 'ign-ortho', 'ign-relief', 'terrain'].map((source) => ({
        source,
        maxZoom: 12,
      })),
    });
    old.close();

    const store = await openTileStore(name);
    const at = { z: 3, x: 4, y: 5 };
    for (const source of ['basemap', 'ign-names', 'ortho'] as const) {
      expect(await store.getTile(source, at)).toBeDefined();
    }
    expect(await store.getTile('terrain', at)).toBeUndefined();
    const [upgraded] = await store.listAreas();
    expect(upgraded?.layers.map((layer) => layer.source)).toEqual([
      'basemap',
      'ign-names',
      'ortho',
    ]);
  });
});
