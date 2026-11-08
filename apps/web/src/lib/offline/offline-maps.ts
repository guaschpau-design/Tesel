// What a download of maps for offline use is made of: which sources, to which zoom, and roughly
// how much it weighs; and whether the areas already downloaded cover a place. Shared by the
// offline maps panel and the offer to download the operation area.

import { formatBytes } from '../format.ts';
import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import {
  countAreaTiles,
  MAX_AREA_TILES,
  missingTiles,
  type DownloadLayer,
} from '../map/tiles/area-download.ts';
import { containsBounds, type Bounds } from '../map/tiles/math.ts';
import type { TileArchives } from '../map/tiles/protocol.ts';
import type { TileStore } from '../map/tiles/store.ts';
import type { OfflineArea } from '../map/tiles/store-schema.ts';
import {
  BASEMAP_MAX_ZOOM,
  ORTHO_EXTRA_ZOOM,
  TERRAIN_MAX_ZOOM,
  type TileSourceId,
} from '../map/tiles/sources.ts';

/** Why a download stopped short of the whole area. */
export type DownloadFailure =
  /** It did not start: it would leave too little room for the group's log (ADR-0056). */
  | { readonly kind: 'no-room'; readonly needed: number; readonly free: number }
  /** The storage filled up while downloading. */
  | { readonly kind: 'storage-full' }
  /** Tile after tile could not be had: no connection, or the service is down. */
  | { readonly kind: 'unreachable' }
  /** It went to the end, but some tiles never came. */
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'failed' };

/** Where downloaded maps are kept, and where their tiles come from. */
export interface OfflineMaps {
  readonly store: TileStore;
  readonly archives: TileArchives;
}

/**
 * What every download holds: the topographic map, Tesel's base map (ADR-0120), which the tactical
 * map shares — the OpenStreetMap map, IGN's names of the terrain, and the elevation its contour
 * lines, the relief and the climbs are worked out from.
 */
const BASE_SOURCES: readonly TileSourceId[] = ['basemap', 'ign-names', 'terrain'];

/** What can be downloaded as well, each from its sources. */
export const EXTRAS = ['aerial'] as const;
export type Extra = (typeof EXTRAS)[number];

const EXTRA_SOURCES: Readonly<Record<Extra, readonly TileSourceId[]>> = {
  aerial: ['ortho'],
};

export const EXTRA_NAMES: Readonly<Record<Extra, MessageKey>> = {
  aerial: 'baseMapAerial',
};

/** The name of what each source was downloaded for. */
const SOURCE_NAMES: Readonly<Record<TileSourceId, MessageKey>> = {
  basemap: 'baseMapTopo',
  'ign-names': 'baseMapTopo',
  terrain: 'baseMapTopo',
  ortho: EXTRA_NAMES.aerial,
};

/** What an area holds, by name: the topographic map and each extra downloaded with it. */
export function areaContents(area: OfflineArea): MessageKey[] {
  return [...new Set(area.layers.map((layer) => SOURCE_NAMES[layer.source]))];
}

/** Rough average size of a tile of each source, only used to estimate download size. */
const AVERAGE_TILE_BYTES: Readonly<Record<TileSourceId, number>> = {
  basemap: 25 * 1024,
  'ign-names': 60 * 1024,
  ortho: 18 * 1024,
  terrain: 120 * 1024,
};

/**
 * Requests in flight at once to each source while downloading. Our own archive takes six, as many
 * as a browser opens to one host. The others are public services, free to use but not ours to
 * load: a download asks them for up to tens of thousands of tiles, and Portugal's DGT draws each
 * one on request (map/tiles/ortho.ts). They are asked two at a time: the download takes longer, and spreads
 * its load on them over that time.
 */
const CONCURRENCY: Readonly<Record<TileSourceId, number>> = {
  basemap: 6,
  'ign-names': 2,
  ortho: 2,
  terrain: 2,
};

/** How deep each source is downloaded, for a map to `maxZoom`. */
function sourceMaxZoom(source: TileSourceId, maxZoom: number): number {
  switch (source) {
    // IGN's names go as deep as the OpenStreetMap map (map/tiles/sources.ts).
    case 'basemap':
    case 'ign-names':
      return maxZoom;
    case 'ortho':
      return maxZoom + ORTHO_EXTRA_ZOOM;
    // Elevation is coarse: deeper tiles hold no more of it.
    case 'terrain':
      return TERRAIN_MAX_ZOOM;
  }
}

/** The layers of a download: the topographic map to `maxZoom`, and the sources of each extra. */
export function downloadLayers(
  archives: TileArchives,
  maxZoom: number,
  extras: readonly Extra[],
): DownloadLayer[] {
  const sources = [...BASE_SOURCES, ...extras.flatMap((extra) => EXTRA_SOURCES[extra])];
  return sources.map((source) => layerOf(archives, source, sourceMaxZoom(source, maxZoom)));
}

/**
 * The OpenStreetMap map alone to `maxZoom`: enough to know where one is from afar, as the overview
 * of the whole region is kept (overview.ts).
 */
export function basemapLayers(archives: TileArchives, maxZoom: number): DownloadLayer[] {
  return [layerOf(archives, 'basemap', maxZoom)];
}

/** The layers of an area, to download again what it is missing (ADR-0056). */
export function areaLayers(archives: TileArchives, area: OfflineArea): DownloadLayer[] {
  return area.layers.map(({ source, maxZoom }) => layerOf(archives, source, maxZoom));
}

function layerOf(archives: TileArchives, source: TileSourceId, maxZoom: number): DownloadLayer {
  return { source, archive: archives[source], maxZoom, concurrency: CONCURRENCY[source] };
}

export function estimatedBytes(bounds: Bounds, layers: readonly DownloadLayer[]): number {
  return layers.reduce(
    (sum, layer) => sum + countAreaTiles(bounds, [layer]) * AVERAGE_TILE_BYTES[layer.source],
    0,
  );
}

/**
 * Roughly what downloading an area takes now: only its tiles not stored yet, so that resuming it,
 * or one overlapping what is kept, is not refused for room it will not use.
 */
export async function bytesStillNeeded(
  store: TileStore,
  bounds: Bounds,
  layers: readonly DownloadLayer[],
): Promise<number> {
  const missing = await missingTiles(store, bounds, layers);
  return layers.reduce(
    (sum, layer, index) => sum + (missing[index] ?? 0) * AVERAGE_TILE_BYTES[layer.source],
    0,
  );
}

/**
 * The most detailed map of `bounds` that fits in one download, or null if not even the least
 * detailed does.
 */
export function detailThatFits(bounds: Bounds, lowestZoom: number): number | null {
  for (let zoom = BASEMAP_MAX_ZOOM; zoom >= lowestZoom; zoom--) {
    if (countAreaTiles(bounds, [{ maxZoom: zoom }]) <= MAX_AREA_TILES) return zoom;
  }
  return null;
}

/** Whether a complete downloaded area already holds the map of `bounds`. */
export function isDownloaded(areas: readonly OfflineArea[], bounds: Bounds): boolean {
  return areas.some(
    (area) =>
      area.complete &&
      containsBounds(area.bounds, bounds) &&
      area.layers.some((layer) => layer.source === 'basemap'),
  );
}

/** What to tell the user about a download that stopped short. */
export function failureText(failure: DownloadFailure, t: Translate, locale: Locale): string {
  switch (failure.kind) {
    case 'no-room':
      return t('downloadNoRoom', {
        needed: formatBytes(failure.needed, locale),
        free: formatBytes(failure.free, locale),
      });
    case 'storage-full':
      return t('downloadStorageFull');
    case 'unreachable':
      return t('downloadUnreachable');
    case 'incomplete':
      return t('downloadIncomplete');
    case 'failed':
      return t('downloadFailed');
  }
}
