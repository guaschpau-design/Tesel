// Downloads every tile of an area, from each of its sources, so the map works without a network.
// A tile that fails is tried again a few times; one that still fails is left out, and the area is
// kept incomplete, to be resumed: a resumed download skips the tiles already stored (ADR-0056).

import { countTiles, tilesInBounds, type Bounds, type TileCoord } from './math.ts';
import type { StoredTile, TileStore } from './store.ts';
import type { OfflineArea } from './store-schema.ts';
import type { TileArchive, TileSourceId } from './sources.ts';

/** One source to download, up to a zoom, from its archive. */
export interface DownloadLayer {
  readonly source: TileSourceId;
  readonly archive: TileArchive;
  readonly maxZoom: number;
  /** Requests in flight at once to the archive. */
  readonly concurrency: number;
}

interface DownloadProgress {
  readonly done: number;
  readonly total: number;
}

/** Tiles to download for an owner of the tile store: an area, or the overview. */
export interface TilesRequest {
  readonly owner: string;
  readonly bounds: Bounds;
  readonly layers: readonly DownloadLayer[];
  readonly signal: AbortSignal;
  readonly onProgress?: (progress: DownloadProgress) => void;
  /** Waits before trying a tile again; injectable for tests. */
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/** What a download stored, and how many tiles it could not have. */
export interface TilesDownloaded {
  readonly stored: number;
  readonly bytes: number;
  readonly failed: number;
}

export interface AreaRequest extends Omit<TilesRequest, 'owner'> {
  /** A new id, or the id of the incomplete area this download resumes. */
  readonly id: string;
  readonly name: string;
  /** Milliseconds since the epoch; a resumed area keeps its own. */
  readonly createdAt: number;
}

/** The download stopped because tile after tile could not be had: the source is out of reach. */
export class SourceUnreachable extends Error {}

/** Largest area we let people download in one go, to protect their storage and data plan. */
export const MAX_AREA_TILES = 20_000;

const MIN_ZOOM = 0;
const WRITE_BATCH = 50;
/** Tiles looked up at once in the store before downloading them, to skip those it has. */
const LOOKUP_BATCH = 256;
/** Waits before each new try at a tile: a passing failure of a service is over in seconds. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
/**
 * Tiles failing one after another, each after all its tries, that stop the download: the source
 * is unreachable, and going on would only spend the data plan on errors.
 */
const FAILURES_IN_A_ROW = 8;

/** How many tiles an area takes, across its sources. */
export function countAreaTiles(
  bounds: Bounds,
  layers: readonly { readonly maxZoom: number }[],
): number {
  return layers.reduce((sum, layer) => sum + countTiles(bounds, MIN_ZOOM, layer.maxZoom), 0);
}

/**
 * How many tiles of each layer of an area are not stored yet: what downloading it would still
 * fetch, whether it is new, resumed or overlaps what is kept.
 */
export async function missingTiles(
  store: TileStore,
  bounds: Bounds,
  layers: readonly Pick<DownloadLayer, 'source' | 'maxZoom'>[],
): Promise<number[]> {
  return Promise.all(
    layers.map(async (layer) => {
      let missing = 0;
      for (const batch of inBatches(tilesInBounds(bounds, MIN_ZOOM, layer.maxZoom))) {
        missing += batch.length - (await store.countStored(layer.source, batch));
      }
      return missing;
    }),
  );
}

/**
 * Downloads an area: saved first as incomplete, so an interrupted download is visible and can be
 * resumed or deleted, and complete once every tile is stored.
 */
export async function downloadArea(store: TileStore, request: AreaRequest): Promise<OfflineArea> {
  const total = countAreaTiles(request.bounds, request.layers);
  if (total > MAX_AREA_TILES) {
    throw new RangeError(`area needs ${total} tiles, maximum ${MAX_AREA_TILES}`);
  }
  const base = {
    id: request.id,
    name: request.name,
    bounds: request.bounds,
    minZoom: MIN_ZOOM,
    layers: request.layers.map(({ source, maxZoom }) => ({ source, maxZoom })),
    createdAt: request.createdAt,
  };
  await store.saveArea({ ...base, storedTiles: 0, bytes: 0, complete: false });
  const { stored, bytes, failed } = await downloadTiles(store, { ...request, owner: request.id });
  const area: OfflineArea = { ...base, storedTiles: stored, bytes, complete: failed === 0 };
  await store.saveArea(area);
  return area;
}

/**
 * Downloads the tiles of `request` its owner does not have yet. Rejects if cancelled, if the
 * store refuses a write, or with `SourceUnreachable`; never goes on in the background after it
 * settles.
 */
export async function downloadTiles(
  store: TileStore,
  request: TilesRequest,
): Promise<TilesDownloaded> {
  // Stops every worker at the first failure of any, as well as on cancelling.
  const stop = new AbortController();
  const cancel = () => {
    stop.abort(request.signal.reason);
  };
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const run: Run = {
    store,
    request,
    signal: stop.signal,
    wait: request.wait ?? wait,
    total: countAreaTiles(request.bounds, request.layers),
    done: 0,
    stored: 0,
    bytes: 0,
    failed: 0,
    failedInARow: 0,
  };
  try {
    for (const layer of request.layers) await downloadLayer(run, layer, stop);
    return { stored: run.stored, bytes: run.bytes, failed: run.failed };
  } finally {
    request.signal.removeEventListener('abort', cancel);
    stop.abort();
  }
}

/** One download as it goes. */
interface Run {
  readonly store: TileStore;
  readonly request: TilesRequest;
  readonly signal: AbortSignal;
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly total: number;
  done: number;
  stored: number;
  bytes: number;
  failed: number;
  failedInARow: number;
}

async function downloadLayer(run: Run, layer: DownloadLayer, stop: AbortController): Promise<void> {
  const { store, request } = run;
  for (const batch of inBatches(tilesInBounds(request.bounds, MIN_ZOOM, layer.maxZoom))) {
    run.signal.throwIfAborted();
    const { missing, kept, bytes } = await store.keepStored(request.owner, layer.source, batch);
    run.stored += kept;
    run.bytes += bytes;
    progress(run, kept);
    let pending: StoredTile[] = [];
    const flush = async () => {
      const tiles = pending;
      pending = [];
      if (tiles.length > 0) await store.putTiles(request.owner, layer.source, tiles);
    };
    const queue = missing.values();
    const worker = async () => {
      for (let next = queue.next(); !next.done; next = queue.next()) {
        run.signal.throwIfAborted();
        const data = await fetchTile(run, layer.archive, next.value);
        if (data !== undefined && data.byteLength > 0) {
          pending.push({ tile: next.value, data });
          run.stored++;
          run.bytes += data.byteLength;
          if (pending.length >= WRITE_BATCH) await flush();
        }
        progress(run, 1);
      }
    };
    const workers = Array.from({ length: layer.concurrency }, () =>
      worker().catch((error: unknown) => {
        stop.abort(error);
        throw error;
      }),
    );
    const outcomes = await Promise.allSettled(workers);
    const failure = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failure !== undefined) throw failure.reason;
    await flush();
  }
}

/**
 * A tile from its archive, tried again after each of the waits; undefined where the archive has
 * none, or when every try failed, which is counted.
 */
async function fetchTile(
  run: Run,
  archive: TileArchive,
  { z, x, y }: TileCoord,
): Promise<ArrayBuffer | undefined> {
  let failure: unknown;
  for (const delay of [0, ...RETRY_DELAYS_MS]) {
    if (delay > 0) await run.wait(delay, run.signal);
    try {
      const data = await archive.getTile(z, x, y, run.signal);
      run.failedInARow = 0;
      return data;
    } catch (error) {
      run.signal.throwIfAborted();
      failure = error;
    }
  }
  console.warn(`Tile ${String(z)}/${String(x)}/${String(y)} could not be downloaded`, failure);
  run.failed++;
  if (++run.failedInARow >= FAILURES_IN_A_ROW) {
    throw new SourceUnreachable(`${String(run.failedInARow)} tiles failed one after another`);
  }
  return undefined;
}

function progress(run: Run, tiles: number): void {
  if (tiles === 0) return;
  run.done += tiles;
  run.request.onProgress?.({ done: run.done, total: run.total });
}

/** Tiles in batches of LOOKUP_BATCH, the last one smaller. */
function* inBatches(tiles: Iterable<TileCoord>): Generator<TileCoord[]> {
  let batch: TileCoord[] = [];
  for (const tile of tiles) {
    batch.push(tile);
    if (batch.length === LOOKUP_BATCH) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
