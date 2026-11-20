// The slopes of the ground (ADR-0155): which a vehicle can climb, worked out on the device from the
// elevation tiles the relief and the contour lines read (tiles/sources.ts), so offline too where
// they were downloaded. Ground a vehicle crosses is left clear; from 30 % it is hard going for one
// on wheels, in amber; from 60 % no vehicle climbs it, in red: the "slow-go" and "no-go" of a
// military terrain analysis. Served as picture tiles through a protocol of their own.

import mlcontour from 'maplibre-contour';
import { addProtocol } from 'maplibre-gl';

import { TERRAIN_MAX_ZOOM } from '../tiles/sources.ts';
import type { Dem } from './dem.ts';

type HeightTile = InstanceType<typeof mlcontour.HeightTile>;

const PROTOCOL = 'tesel-slope';
const URL_PATTERN = new RegExp(`^${PROTOCOL}://(\\d+)/(\\d+)/(\\d+)$`);

/** Slopes are worked out from this zoom, a district's: further out the tiles smooth them away. */
export const SLOPE_MIN_ZOOM = 11;
export const SLOPE_MAX_ZOOM = TERRAIN_MAX_ZOOM;

/** Grades, in percent, from which a slope is hard going for a vehicle, and from which none climbs. */
export const HARD_PERCENT = 30;
export const NO_GO_PERCENT = 60;

/** Amber and red, see-through, over the ground. */
const HARD: readonly [number, number, number, number] = [235, 150, 20, 110];
const NO_GO: readonly [number, number, number, number] = [200, 30, 30, 140];

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export function slopeTileUrl(): string {
  return `${PROTOCOL}://{z}/{x}/{y}`;
}

/** The grade, in percent, at a point of a grid of heights `metres` apart, from its neighbours. */
export function gradePercent(
  height: (x: number, y: number) => number,
  x: number,
  y: number,
  metres: number,
): number {
  const east = (height(x + 1, y) - height(x - 1, y)) / (2 * metres);
  const south = (height(x, y + 1) - height(x, y - 1)) / (2 * metres);
  return 100 * Math.hypot(east, south);
}

/**
 * The picture of a tile's slopes: `size` × `size` pixels, RGBA, from heights that can be read one
 * pixel past each edge, `metres` apart.
 */
export function slopePixels(
  height: (x: number, y: number) => number,
  size: number,
  metres: number,
): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grade = gradePercent(height, x, y, metres);
      const colour = grade >= NO_GO_PERCENT ? NO_GO : grade >= HARD_PERCENT ? HARD : null;
      if (colour !== null) pixels.set(colour, (y * size + x) * 4);
    }
  }
  return pixels;
}

/** Metres between the pixels of a tile `size` pixels across, at its middle. */
export function metresPerPixel(z: number, y: number, size: number): number {
  const n = Math.PI - (2 * Math.PI * (y + 0.5)) / 2 ** z;
  const lat = Math.atan(Math.sinh(n));
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat)) / (2 ** z * size);
}

/** Serves the slope tiles, from the elevation `dem` reads (dem.ts). */
export function registerSlopeProtocol(dem: Dem): void {
  addProtocol(PROTOCOL, async (params, abortController) => {
    const match = URL_PATTERN.exec(params.url);
    if (!match) throw new Error(`not a ${PROTOCOL} URL: ${params.url}`);
    const [z, x, y] = match.slice(1).map(Number) as [number, number, number];
    // The tile and its eight neighbours, for the pixels at its edges.
    const max = 2 ** z;
    const around: Promise<HeightTile | undefined>[] = [];
    for (let row = y - 1; row <= y + 1; row++) {
      for (let column = x - 1; column <= x + 1; column++) {
        around.push(
          row < 0 || row >= max
            ? Promise.resolve(undefined)
            : dem.fetchDem(z, (column + max) % max, row, { levels: [] }, abortController),
        );
      }
    }
    const heights = mlcontour.HeightTile.combineNeighbors(await Promise.all(around));
    if (heights === undefined) throw new Error(`no elevation for slope tile ${params.url}`);
    const size = heights.width;
    const grid = heights.materialize(1);
    const pixels = slopePixels(grid.get, size, metresPerPixel(z, y, size));
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no 2D canvas');
    context.putImageData(new ImageData(pixels, size, size), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
}
