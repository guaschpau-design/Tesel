// Where the map's tiles come from. The base vector map is our own PMTiles archive. The satellite
// map is a Sentinel-2 mosaic from afar and the national orthophotos of Spain, Portugal and France
// close up (ortho.ts, ADR-0023, ADR-0041). The topographic map's names of the terrain come from
// IGN's vector map of Spain (ADR-0034). Elevation, for the relief, the contour lines and every
// measure, comes from Mapterhorn (ADR-0037). Every source is read through the same protocol, which answers from the
// tiles downloaded for offline use first (protocol.ts).

import { satelliteMosaic, type SatelliteMosaic } from '../../config.ts';

/** Anything that can return a tile: our PMTiles archive, or a web map service. */
export interface TileArchive {
  /**
   * Resolves to the tile bytes, or undefined if the archive has no tile there (empty area); rejects
   * if the tile cannot be had now.
   */
  getTile(z: number, x: number, y: number, signal: AbortSignal): Promise<ArrayBuffer | undefined>;
}

export const TILE_SOURCES = ['basemap', 'ign-names', 'ortho', 'terrain'] as const;
export type TileSourceId = (typeof TILE_SOURCES)[number];

/** CC BY 4.0, as the services of Spain's national mapping system (SCNE) ask to be credited. */
const SCNE = '<a href="https://www.scne.es" target="_blank">CC BY 4.0 scne.es</a>';

/**
 * Highest zoom of the vector base map we download and request; MapLibre over-zooms beyond it. It
 * is the last level of the Protomaps builds, the only one that holds every point of interest:
 * pharmacies, most police stations and doctors are not in the levels above. The other sources'
 * limits follow from it, so an area downloaded holds each to the same detail.
 */
export const BASEMAP_MAX_ZOOM = 15;

/**
 * Photographs need three zooms more than the vector map for the same detail: their tiles cannot be
 * enlarged without blurring.
 */
export const ORTHO_EXTRA_ZOOM = 3;

/** The orthophotos are drawn and downloaded up to this zoom; MapLibre enlarges them beyond it. */
export const ORTHO_MAX_ZOOM = BASEMAP_MAX_ZOOM + ORTHO_EXTRA_ZOOM;

/** A mosaic of EOX's: its layer in the WMTS, and the credit its licence asks for, licence named. */
interface Mosaic {
  readonly layer: string;
  readonly credit: string;
}

const EOX = '<a href="https://cloudless.eox.at" target="_blank">EOxCloudless</a>';

/** The mosaics a build can choose (config.ts, ADR-0051). */
const MOSAICS: Readonly<Record<SatelliteMosaic, Mosaic>> = {
  's2cloudless-2024': {
    layer: 's2cloudless-2024_3857',
    credit:
      `${EOX} 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024), ` +
      '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank">CC BY-NC-SA 4.0</a>',
  },
  's2cloudless-2016': {
    layer: 's2cloudless_3857',
    credit:
      `${EOX} 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 & ` +
      '2017), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC BY 4.0</a>',
  },
};

export const MOSAIC = MOSAICS[satelliteMosaic()];

export const ORTHO_ATTRIBUTION =
  `${MOSAIC.credit} | ` +
  `${SCNE} · PNOA | ` +
  '<a href="https://www.dgterritorio.gov.pt" target="_blank">CC BY 4.0 DGT</a> · OrtoSat 2023 | ' +
  '<a href="https://www.ign.fr" target="_blank">IGN – BD ORTHO</a>';

/**
 * IGN's vector map of Spain (Mapa Base): the topographic map reads its names of the terrain. Its
 * tiles go deeper, but the OpenStreetMap map's last zoom holds them all, so they are read to that
 * zoom.
 */
export const NAMES_ATTRIBUTION = `${SCNE} · Mapa Base`;

export function namesTileUrl(z: number, x: number, y: number): string {
  return `https://vt-mapabase.idee.es/1.0.0/mapabase/${String(z)}/${String(x)}/${String(y)}.pbf`;
}

/**
 * Mapterhorn's elevation tiles: 512 pixels wide in the Terrarium encoding (metres = R × 256 + G +
 * B / 256 − 32768), built from the best open elevation models of each country (in Spain, Portugal
 * and France their national ones, from LiDAR) and Copernicus GLO-30 elsewhere. At this zoom a pixel
 * is about 10 m: deeper tiles shade and measure no differently, and weigh four times as much.
 */
export const TERRAIN_MAX_ZOOM = 13;
export const TERRAIN_TILE_SIZE = 512;

export const TERRAIN_ATTRIBUTION =
  '<a href="https://mapterhorn.com/attribution" target="_blank">© Mapterhorn</a>';

export function terrainTileUrl(z: number, x: number, y: number): string {
  return `https://tiles.mapterhorn.com/${String(z)}/${String(x)}/${String(y)}.webp`;
}

/**
 * A web tile service as a tile archive: undefined where it has no tile, which it says with a
 * client error. A server error or too many requests is a failure, worth trying again later, and so
 * is an error told as text with a success status (a WMS exception, a proxy's page): it must not be
 * kept as a tile.
 */
export function webArchive(url: (z: number, x: number, y: number) => string): TileArchive {
  return {
    async getTile(z, x, y, signal) {
      const response = await fetch(url(z, x, y), { signal });
      if (response.status >= 500 || response.status === 429 || response.status === 408) {
        throw new Error(`tile service answered ${String(response.status)}`);
      }
      if (!response.ok) return undefined;
      const type = response.headers.get('Content-Type') ?? '';
      if (/^text\/|xml|html|json/i.test(type)) {
        throw new Error(`tile service answered ${type} instead of a tile`);
      }
      return response.arrayBuffer();
    },
  };
}

/**
 * An archive made the first time a tile is asked for: one whose code is loaded only then, so that
 * those who never look at it never download it.
 */
export function lazyArchive(load: () => Promise<TileArchive>): TileArchive {
  let archive: Promise<TileArchive> | undefined;
  return {
    async getTile(z, x, y, signal) {
      archive ??= load();
      return (await archive).getTile(z, x, y, signal);
    },
  };
}
