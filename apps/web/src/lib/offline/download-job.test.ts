import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TileArchive } from '../map/tiles/sources.ts';
import { openTileStore, type TileStore } from '../map/tiles/store.ts';
import { DownloadJob, type DownloadPlan } from './download-job.svelte.ts';

let databases = 0;
const freshStore = () => openTileStore(`download-job-${String(++databases)}`);

const bounds = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };
const tile = new Uint8Array([1, 2, 3]).buffer;

const everyTile: TileArchive = { getTile: () => Promise.resolve(tile) };
const brokenService: TileArchive = { getTile: () => Promise.reject(new Error('503')) };

/** A service whose tiles wait until it is opened, or until the request is cancelled. */
function heldService(): { archive: TileArchive; open: () => void } {
  const { promise: opened, resolve: open } = Promise.withResolvers<undefined>();
  const archive: TileArchive = {
    getTile: (_z, _x, _y, signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(signal.reason as Error);
        });
        void opened.then(() => {
          resolve(tile);
        });
      }),
  };
  return {
    archive,
    open: () => {
      open(undefined);
    },
  };
}

function plan(archive: TileArchive): DownloadPlan {
  return {
    name: 'Valencia',
    bounds,
    layers: [{ source: 'basemap', archive, maxZoom: 10, concurrency: 2 }],
  };
}

/** The browser's storage manager: the job asks it for room, and to keep the tiles. */
function storageWith(free: number) {
  return {
    storage: {
      persist: () => Promise.resolve(true),
      estimate: () => Promise.resolve({ usage: 1024, quota: 1024 + free }),
    },
  };
}

describe('a download of an area', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', storageWith(1024 ** 3));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('follows its progress to the end and keeps the whole area', async () => {
    const store = await freshStore();
    const job = new DownloadJob();
    const service = heldService();
    const running = job.run(store, plan(service.archive));
    await vi.waitFor(() => {
      expect(job.running).toBe(true);
    });
    expect(job.progress?.done).toBe(0);
    const total = job.progress?.total ?? 0;
    expect(total).toBeGreaterThan(0);
    service.open();

    await expect(running).resolves.toBe(true);
    expect(job.running).toBe(false);
    expect(job.failure).toBeNull();
    const [area] = await store.listAreas();
    expect(area).toMatchObject({ name: 'Valencia', complete: true, storedTiles: total });
  });

  it('does not start without room for the area and for the group’s log', async () => {
    vi.stubGlobal('navigator', storageWith(10 * 1024 ** 2));
    const store = await freshStore();
    const job = new DownloadJob();
    await expect(job.run(store, plan(everyTile))).resolves.toBe(false);
    expect(job.failure).toMatchObject({ kind: 'no-room', free: 0 });
    expect(await store.listAreas()).toEqual([]);
  });

  it('counts only the tiles it still has to fetch when it checks for room', async () => {
    const store = await freshStore();
    const job = new DownloadJob();
    await expect(job.run(store, plan(everyTile))).resolves.toBe(true);
    // No room left for anything new, and nothing new to store: the same area downloads again.
    vi.stubGlobal('navigator', storageWith(10 * 1024 ** 2));
    await expect(job.run(store, plan(everyTile))).resolves.toBe(true);
    expect(job.failure).toBeNull();
  });

  it('says the service is out of reach when tile after tile fails, and never rejects', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const job = new DownloadJob();
    const running = job.run(await freshStore(), plan(brokenService));
    let result: boolean | undefined;
    void running.then((value) => (result = value));
    while (result === undefined) await vi.advanceTimersByTimeAsync(1000);
    expect(result).toBe(false);
    expect(job.failure).toEqual({ kind: 'unreachable' });
    expect(job.running).toBe(false);
  });

  it('says the storage filled up, and resumes into the same area once there is room', async () => {
    const store = await freshStore();
    const full: TileStore = {
      getTile: (source, at) => store.getTile(source, at),
      putTiles: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
      keepStored: (owner, source, tiles) => store.keepStored(owner, source, tiles),
      countStored: (source, tiles) => store.countStored(source, tiles),
      keepViewed: (source, at, data) => store.keepViewed(source, at, data),
      saveArea: (area) => store.saveArea(area),
      listAreas: () => store.listAreas(),
      deleteArea: (area) => store.deleteArea(area),
    };
    const job = new DownloadJob();
    await expect(job.run(full, plan(everyTile))).resolves.toBe(false);
    expect(job.failure).toEqual({ kind: 'storage-full' });

    const [stopped] = await store.listAreas();
    if (stopped === undefined) throw new Error('no area');
    await expect(job.run(store, { ...plan(everyTile), resumes: stopped })).resolves.toBe(true);
    const areas = await store.listAreas();
    expect(areas).toMatchObject([{ id: stopped.id, createdAt: stopped.createdAt, complete: true }]);
  });

  it('stops when cancelled, without calling it a failure', async () => {
    const store = await freshStore();
    const job = new DownloadJob();
    const running = job.run(store, plan(heldService().archive));
    // Once the area is recorded, its tiles are on their way.
    await vi.waitFor(async () => {
      expect(await store.listAreas()).toHaveLength(1);
    });
    job.cancel();
    await expect(running).resolves.toBe(false);
    expect(job.failure).toBeNull();
    const [area] = await store.listAreas();
    expect(area?.complete).toBe(false);
  });

  it('can be cancelled while it still checks for room, and then downloads nothing', async () => {
    const { promise: answered, resolve: answer } = Promise.withResolvers<StorageEstimate>();
    vi.stubGlobal('navigator', {
      storage: { persist: () => Promise.resolve(true), estimate: () => answered },
    });
    const store = await freshStore();
    const job = new DownloadJob();
    const running = job.run(store, plan(everyTile));
    expect(job.running).toBe(true);
    job.cancel();
    answer({ usage: 0, quota: 1024 ** 3 });
    await expect(running).resolves.toBe(false);
    expect(job.failure).toBeNull();
    expect(await store.listAreas()).toEqual([]);
  });
});
