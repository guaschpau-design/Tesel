// Elevations of points, read from Terrarium elevation tiles (map/tiles/sources.ts): the tiles are
// decoded once and kept while they are in use, since guidance asks for the same ones again and
// again as the device moves.

import type { LatLon } from '@tesel/protocol';

import { tileAt, tileKey, type TileCoord } from '../map/tiles/math.ts';
import { TERRAIN_MAX_ZOOM } from '../map/tiles/sources.ts';

/** The pixels of a decoded tile: RGBA, row by row. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Where elevations come from: an ElevationReader, or in tests a made-up ground. */
export interface Heights {
  elevations(points: readonly LatLon[]): Promise<(number | null)[]>;
}

/** Tile bytes from wherever they are (downloaded, or the network); undefined if not to be had. */
export type ElevationTiles = (tile: TileCoord) => Promise<ArrayBuffer | undefined>;

/** Decoded tiles kept at once: a few kilometres around the device. */
const CACHE_TILES = 24;

/** Metres above sea level of a Terrarium pixel. */
export function terrariumMetres(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32_768;
}

export class ElevationReader implements Heights {
  readonly #tiles: ElevationTiles;
  readonly #decode: (bytes: ArrayBuffer) => Promise<Pixels>;
  /**
   * Decoded tiles, least recently used first. A tile that could not be had is forgotten once that
   * is known, so that it is tried again: it may be downloaded, or the network back, by then.
   */
  readonly #cache = new Map<string, Promise<Pixels | null>>();

  constructor(
    tiles: ElevationTiles,
    decode: (bytes: ArrayBuffer) => Promise<Pixels> = decodeImage,
  ) {
    this.#tiles = tiles;
    this.#decode = decode;
  }

  /** Elevations in metres, in the order of the points; null where unknown. */
  async elevations(points: readonly LatLon[]): Promise<(number | null)[]> {
    return Promise.all(points.map((point) => this.#elevation(point)));
  }

  async #elevation(at: LatLon): Promise<number | null> {
    const { tile, u, v } = tileAt(at, TERRAIN_MAX_ZOOM);
    const pixels = await this.#pixels(tile);
    if (pixels === null) return null;
    const column = Math.min(pixels.width - 1, Math.floor(u * pixels.width));
    const row = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
    const offset = (row * pixels.width + column) * 4;
    const { data } = pixels;
    return terrariumMetres(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
  }

  #pixels(tile: TileCoord): Promise<Pixels | null> {
    const key = tileKey(tile);
    let pixels = this.#cache.get(key);
    if (pixels === undefined) {
      const loading = this.#load(tile);
      pixels = loading;
      void loading.then((loaded) => {
        if (loaded === null && this.#cache.get(key) === loading) this.#cache.delete(key);
      });
      if (this.#cache.size >= CACHE_TILES) {
        const [oldest] = this.#cache.keys();
        if (oldest !== undefined) this.#cache.delete(oldest);
      }
    } else {
      this.#cache.delete(key);
    }
    this.#cache.set(key, pixels);
    return pixels;
  }

  async #load(tile: TileCoord): Promise<Pixels | null> {
    try {
      const bytes = await this.#tiles(tile);
      return bytes === undefined ? null : await this.#decode(bytes);
    } catch {
      return null;
    }
  }
}

/** The pixels of an image file, whatever its format (the tiles are WebP, the fallback PNG). */
async function decodeImage(bytes: ArrayBuffer): Promise<Pixels> {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('no 2D canvas');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
