// Serves map tiles to MapLibre through one protocol for every source: stored tiles first,
// then the network (sources.ts).

import { addProtocol } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import type { TileArchive } from './sources.ts';
import { EMPTY_RASTER_TILE, EMPTY_VECTOR_TILE, FLAT_TERRAIN_TILE } from './empty-tiles.ts';
import type { Bounds, TileCoord } from './math.ts';
import type { TileStore } from './store.ts';
import {
  lazyArchive,
  namesTileUrl,
  terrainTileUrl,
  TILE_SOURCES,
  webArchive,
  type TileSourceId,
} from './sources.ts';

const PROTOCOL = 'tesel-tiles';

/** Tile URL template of a source, for the map style. */
export function tileUrlTemplate(source: TileSourceId): string {
  return `${PROTOCOL}://${source}/{z}/{x}/{y}`;
}

const TILE_URL_PATTERN = new RegExp(`^${PROTOCOL}://([a-z-]+)/(\\d+)/(\\d+)/(\\d+)$`);

/** Our base map: one PMTiles archive, which also says what part of the world it covers. */
interface BasemapArchive extends TileArchive {
  bounds(): Promise<Bounds>;
}

/**
 * pmtiles keeps a failed fetch of the archive's header or directories for good, so one failure
 * offline would leave the base map blank for the rest of the session. After a failure that was
 * not a cancellation, reading starts again with a fresh reader: the map comes back with the
 * connection.
 */
function pmtilesArchive(url: string): BasemapArchive {
  let archive = new PMTiles(url);
  async function read<T>(use: (reader: PMTiles) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const reader = archive;
    try {
      return await use(reader);
    } catch (error) {
      if (!signal?.aborted && archive === reader) archive = new PMTiles(url);
      throw error;
    }
  }
  return {
    async getTile(z, x, y, signal) {
      return (await read((reader) => reader.getZxy(z, x, y, signal), signal))?.data;
    },
    async bounds() {
      const { minLon, minLat, maxLon, maxLat } = await read((reader) => reader.getHeader());
      return { west: minLon, south: minLat, east: maxLon, north: maxLat };
    },
  };
}

/** What reading a tile needs of the tile store: the tiles it holds, and keeping those seen. */
export type TileReader = Pick<TileStore, 'getTile' | 'keepViewed'>;

/** What each source shows where it has no tile (empty-tiles.ts). */
const NOTHING: Readonly<Record<TileSourceId, ArrayBuffer>> = {
  basemap: EMPTY_VECTOR_TILE,
  'ign-names': EMPTY_VECTOR_TILE,
  ortho: EMPTY_RASTER_TILE,
  terrain: FLAT_TERRAIN_TILE,
};

export interface TileArchives extends Readonly<Record<TileSourceId, TileArchive>> {
  readonly basemap: BasemapArchive;
}

/** Where each source's tiles come from when they are not downloaded. */
export function tileArchives(basemapUrl: string): TileArchives {
  return {
    basemap: pmtilesArchive(basemapUrl),
    'ign-names': webArchive(namesTileUrl),
    // The satellite map and its country outlines, a quarter of a megabyte, load with its first tile.
    ortho: lazyArchive(async () => (await import('./ortho.ts')).orthoArchive()),
    terrain: webArchive(terrainTileUrl),
  };
}

/**
 * One tile of a source: stored first (downloaded, or seen before), then the network; undefined if
 * it cannot be had. A tile from the network is kept among those seen, for when there is none.
 */
export async function findTile(
  source: TileSourceId,
  tile: TileCoord,
  store: TileReader,
  archives: TileArchives,
  signal?: AbortSignal,
): Promise<ArrayBuffer | undefined> {
  const local = await store.getTile(source, tile);
  if (local !== undefined) return local;
  try {
    const data = await archives[source].getTile(
      tile.z,
      tile.x,
      tile.y,
      signal ?? new AbortController().signal,
    );
    // A copy: MapLibre takes the bytes it is given away to its workers, and the store keeps them
    // once its transaction is under way.
    if (data !== undefined && data.byteLength > 0)
      void store.keepViewed(source, tile, data.slice(0));
    return data;
  } catch {
    return undefined;
  }
}

/**
 * Resolves one tile for the map. A tile that cannot be had — no network, nothing there — resolves
 * to the source's empty tile instead of an error: offline, the map shows what is stored and leaves
 * the rest blank.
 */
export async function loadTile(
  url: string,
  store: TileReader,
  archives: TileArchives,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const match = TILE_URL_PATTERN.exec(url);
  const source = TILE_SOURCES.find((id) => id === match?.[1]);
  if (!match || source === undefined) throw new Error(`not a ${PROTOCOL} URL: ${url}`);
  const [z, x, y] = match.slice(2).map(Number) as [number, number, number];
  // A copy of the empty tile each time: MapLibre gives the bytes away to a worker, which leaves the
  // shared one empty for the next tile.
  return (await findTile(source, { z, x, y }, store, archives, signal)) ?? NOTHING[source].slice(0);
}

export function registerTileProtocol(store: TileReader, archives: TileArchives): void {
  addProtocol(PROTOCOL, async (params, abortController) => ({
    data: await loadTile(params.url, store, archives, abortController.signal),
  }));
}
