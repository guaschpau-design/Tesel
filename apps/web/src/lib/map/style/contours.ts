// Contour lines, worked out on the device from the elevation tiles (tiles/sources.ts) for the
// topographic map, wherever there is elevation (ADR-0037). maplibre-contour turns them into vector
// tiles served through a protocol of their own; it reads the elevation tiles through ours, so the
// lines are there offline wherever the relief was downloaded.

import mlcontour from 'maplibre-contour';
import { addProtocol } from 'maplibre-gl';

import type { TileArchives } from '../tiles/protocol.ts';
import { loadTile, tileUrlTemplate } from '../tiles/protocol.ts';
import type { TileStore } from '../tiles/store.ts';
import { BASEMAP_MAX_ZOOM, TERRAIN_MAX_ZOOM } from '../tiles/sources.ts';

const PROTOCOL = 'tesel-contours';
const URL_PATTERN = new RegExp(`^${PROTOCOL}://(\\d+)/(\\d+)/(\\d+)$`);

/** The vector layer of the contour tiles, and the keys of each line's height and rank. */
export const CONTOUR_LAYER = 'contours';
export const HEIGHT_KEY = 'ele';
/** 1 for an index line, 0 for the others. */
export const RANK_KEY = 'level';

/**
 * Contour tiles are made from this zoom to the OpenStreetMap map's last; MapLibre enlarges it
 * beyond.
 */
export const CONTOURS_MIN_ZOOM = 11;
export const CONTOURS_MAX_ZOOM = BASEMAP_MAX_ZOOM;

/** Decoded elevation tiles kept at once: a tile and its eight neighbours, several times over. */
const CACHE_TILES = 64;
const TIMEOUT_MS = 20_000;

export function contourTileUrl(): string {
  return `${PROTOCOL}://{z}/{x}/{y}`;
}

/**
 * Metres between lines and between index lines at a zoom: every 100 m on a regional view, every
 * 25 m on a town's, every 10 m closer.
 */
export function contourIntervals(zoom: number): [every: number, index: number] {
  if (zoom >= 14) return [10, 50];
  if (zoom >= 13) return [25, 100];
  return [100, 500];
}

export function registerContourProtocol(store: TileStore, archives: TileArchives): void {
  const elevation = new mlcontour.LocalDemManager({
    demUrlPattern: tileUrlTemplate('terrain'),
    cacheSize: CACHE_TILES,
    encoding: 'terrarium',
    maxzoom: TERRAIN_MAX_ZOOM,
    timeoutMs: TIMEOUT_MS,
    getTile: async (url, abortController) => ({
      data: new Blob([await loadTile(url, store, archives, abortController.signal)]),
    }),
  });
  addProtocol(PROTOCOL, async (params, abortController) => {
    const match = URL_PATTERN.exec(params.url);
    if (!match) throw new Error(`not a ${PROTOCOL} URL: ${params.url}`);
    const [z, x, y] = match.slice(1).map(Number) as [number, number, number];
    const tile = await elevation.fetchContourTile(
      z,
      x,
      y,
      {
        levels: contourIntervals(z),
        contourLayer: CONTOUR_LAYER,
        elevationKey: HEIGHT_KEY,
        levelKey: RANK_KEY,
      },
      abortController,
    );
    return { data: tile.arrayBuffer };
  });
}
