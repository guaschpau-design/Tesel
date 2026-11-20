// The elevation tiles as the contour lines (contours.ts) and the slopes (slope.ts) read them: one
// reader for both, decoding each tile once, through our tile protocol so that they work offline
// where the relief was downloaded.

import mlcontour from 'maplibre-contour';

import type { TileArchives } from '../tiles/protocol.ts';
import { loadTile, tileUrlTemplate } from '../tiles/protocol.ts';
import type { TileStore } from '../tiles/store.ts';
import { TERRAIN_MAX_ZOOM } from '../tiles/sources.ts';

/** Decoded elevation tiles kept at once: a tile and its eight neighbours, several times over. */
const CACHE_TILES = 64;
const TIMEOUT_MS = 20_000;

export type Dem = InstanceType<typeof mlcontour.LocalDemManager>;

export function elevationTiles(store: TileStore, archives: TileArchives): Dem {
  return new mlcontour.LocalDemManager({
    demUrlPattern: tileUrlTemplate('terrain'),
    cacheSize: CACHE_TILES,
    encoding: 'terrarium',
    maxzoom: TERRAIN_MAX_ZOOM,
    timeoutMs: TIMEOUT_MS,
    getTile: async (url, abortController) => ({
      data: new Blob([await loadTile(url, store, archives, abortController.signal)]),
    }),
  });
}
