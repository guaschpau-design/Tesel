// Offline storage of map tiles and of the areas they were downloaded for (IndexedDB).
//
// Each tile is stored under its source and coordinates, and records who needs it: the areas it was
// downloaded for and the overview of the base map (offline/overview.ts). Areas may overlap; deleting
// one only removes tiles nothing else needs. Tiles the map showed while online are kept too, the
// latest of them up to a size, so that a place seen once can be seen again offline (ADR-0056).

import { openDB, type IDBPDatabase } from 'idb';

import { isStorageFull } from '../../storage/storage-space.svelte.ts';
import { IGNORE_VERSION_CHANGE, type VersionChange } from '../../storage/version-change.ts';
import { tileKey, tilesInBounds, type TileCoord } from './math.ts';
import type { TileSourceId } from './sources.ts';
import type { MapDb, OfflineArea } from './store-schema.ts';
import { keyBySource, renameSources } from './store-upgrades.ts';

export interface StoredTile {
  readonly tile: TileCoord;
  readonly data: ArrayBuffer;
}

/** Which of the tiles an owner asked for were stored already, and which are still to download. */
interface KeptTiles {
  readonly missing: TileCoord[];
  /** How many were stored, and their size. */
  readonly kept: number;
  readonly bytes: number;
}

export interface TileStore {
  getTile(source: TileSourceId, tile: TileCoord): Promise<ArrayBuffer | undefined>;
  /**
   * Stores tiles of one source for an owner in one transaction: an area, under its id, or the
   * overview.
   */
  putTiles(owner: string, source: TileSourceId, tiles: readonly StoredTile[]): Promise<void>;
  /**
   * Records that `owner` needs those of `tiles` already stored, for whatever reason, so they need
   * not be downloaded again; returns the others.
   */
  keepStored(owner: string, source: TileSourceId, tiles: readonly TileCoord[]): Promise<KeptTiles>;
  /**
   * Keeps a tile the map fetched while online, among the latest ones fetched. A tile already kept
   * is served from here and not fetched again, so the cache drops first what was first kept, not
   * what was least looked at: telling them apart would mean a write for every tile drawn. Never
   * fails: it is a cache.
   */
  keepViewed(source: TileSourceId, tile: TileCoord, data: ArrayBuffer): Promise<void>;
  saveArea(area: OfflineArea): Promise<void>;
  listAreas(): Promise<OfflineArea[]>;
  deleteArea(area: OfflineArea): Promise<void>;
}

const DB_NAME = 'tesel-map';
const DB_VERSION = 5;

/**
 * Room for tiles seen online: some 2,500 tiles of the street map, a city and its surroundings
 * looked at closely. Downloaded areas are where offline maps are meant to come from.
 */
const VIEWED_BYTES = 64 * 1024 * 1024;
/** Tiles seen between two checks of the room they take. */
const VIEWED_CHECK_EVERY = 64;

/** Where a tile is kept: its source, then z/x/y. */
function storageKey(source: TileSourceId, tile: TileCoord): string {
  return `${source}/${tileKey(tile)}`;
}

export async function openTileStore(
  name: string = DB_NAME,
  change: VersionChange = IGNORE_VERSION_CHANGE,
): Promise<TileStore> {
  const db: IDBPDatabase<MapDb> = await openDB<MapDb>(name, DB_VERSION, {
    blocked: change.onBlocked,
    blocking() {
      db.close();
      change.onReplaced();
    },
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      }
      // The upgrade transaction stays open while its requests run; openDB resolves after.
      if (oldVersion === 1) void keyBySource(transaction);
      if (oldVersion === 2 || oldVersion === 3) void renameSources(transaction);
      if (oldVersion < 5) database.createObjectStore('viewed');
    },
  });
  return new IndexedDbTileStore(db);
}

class IndexedDbTileStore implements TileStore {
  readonly #db: IDBPDatabase<MapDb>;
  /** Tiles seen since the room they take was last checked. */
  #viewedSinceCheck = 0;

  constructor(db: IDBPDatabase<MapDb>) {
    this.#db = db;
  }

  async getTile(source: TileSourceId, tile: TileCoord): Promise<ArrayBuffer | undefined> {
    return (await this.#db.get('tiles', storageKey(source, tile)))?.data;
  }

  async putTiles(owner: string, source: TileSourceId, tiles: readonly StoredTile[]): Promise<void> {
    const tx = this.#db.transaction(['tiles', 'viewed'], 'readwrite');
    const store = tx.objectStore('tiles');
    await Promise.all([
      ...tiles.map(async ({ tile, data }) => {
        const key = storageKey(source, tile);
        const existing = await store.get(key);
        await store.put({ data, areas: withOwner(existing?.areas ?? [], owner) }, key);
        // Needed now, it is no longer only a tile seen.
        await tx.objectStore('viewed').delete(key);
      }),
      tx.done,
    ]);
  }

  async keepStored(
    owner: string,
    source: TileSourceId,
    tiles: readonly TileCoord[],
  ): Promise<KeptTiles> {
    const tx = this.#db.transaction(['tiles', 'viewed'], 'readwrite');
    const store = tx.objectStore('tiles');
    const sizes = await Promise.all(
      tiles.map(async (tile) => {
        const key = storageKey(source, tile);
        const existing = await store.get(key);
        if (existing === undefined) return null;
        await store.put({ data: existing.data, areas: withOwner(existing.areas, owner) }, key);
        await tx.objectStore('viewed').delete(key);
        return existing.data.byteLength;
      }),
    );
    await tx.done;
    const kept = sizes.filter((size) => size !== null);
    return {
      missing: tiles.filter((_, index) => sizes[index] === null),
      kept: kept.length,
      bytes: kept.reduce((sum, size) => sum + size, 0),
    };
  }

  async keepViewed(source: TileSourceId, tile: TileCoord, data: ArrayBuffer): Promise<void> {
    try {
      const tx = this.#db.transaction(['tiles', 'viewed'], 'readwrite');
      const key = storageKey(source, tile);
      if ((await tx.objectStore('tiles').getKey(key)) === undefined) {
        await Promise.all([
          tx.objectStore('tiles').put({ data, areas: [] }, key),
          tx.objectStore('viewed').put({ seen: Date.now(), size: data.byteLength }, key),
        ]);
      }
      await tx.done;
      if (++this.#viewedSinceCheck >= VIEWED_CHECK_EVERY) {
        this.#viewedSinceCheck = 0;
        await this.#forgetViewed(VIEWED_BYTES);
      }
    } catch (error) {
      console.warn('Keeping a tile seen failed', error);
      // Tiles seen are the first to go when the storage is full: the group's log needs the room.
      if (isStorageFull(error)) await this.#forgetViewed(0).catch(() => undefined);
    }
  }

  async saveArea(area: OfflineArea): Promise<void> {
    await this.#db.put('areas', area);
  }

  async listAreas(): Promise<OfflineArea[]> {
    const areas = await this.#db.getAll('areas');
    return areas.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteArea(area: OfflineArea): Promise<void> {
    const tx = this.#db.transaction(['tiles', 'areas'], 'readwrite');
    const tiles = tx.objectStore('tiles');
    for (const { source, maxZoom } of area.layers) {
      for (const coord of tilesInBounds(area.bounds, area.minZoom, maxZoom)) {
        const key = storageKey(source, coord);
        const existing = await tiles.get(key);
        if (!existing) continue;
        const areas = existing.areas.filter((id) => id !== area.id);
        if (areas.length === 0) await tiles.delete(key);
        else await tiles.put({ data: existing.data, areas }, key);
      }
    }
    await tx.objectStore('areas').delete(area.id);
    await tx.done;
  }

  /** Forgets the tiles kept longest ago, until those left take at most `room` bytes. */
  async #forgetViewed(room: number): Promise<void> {
    const tx = this.#db.transaction(['tiles', 'viewed'], 'readwrite');
    const viewed = tx.objectStore('viewed');
    const [keys, entries] = await Promise.all([viewed.getAllKeys(), viewed.getAll()]);
    const seen = entries
      .map((entry, index) => ({ ...entry, key: keys[index] ?? '' }))
      .sort((a, b) => a.seen - b.seen);
    let bytes = seen.reduce((sum, entry) => sum + entry.size, 0);
    const forget: string[] = [];
    for (const entry of seen) {
      if (bytes <= room) break;
      forget.push(entry.key);
      bytes -= entry.size;
    }
    await Promise.all([
      ...forget.flatMap((key) => [viewed.delete(key), tx.objectStore('tiles').delete(key)]),
      tx.done,
    ]);
  }
}

/** The owners of a tile with one more, once. */
function withOwner(owners: readonly string[], owner: string): string[] {
  return owners.includes(owner) ? [...owners] : [...owners, owner];
}
