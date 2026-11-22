// The area the server's own archives cover (build-*.ts): its bounds as the operator gives them,
// and its tiles at the zooms an archive holds, in the order an archive keeps them.

import { zxyToTileId } from 'pmtiles';

export type Bounds = readonly [number, number, number, number];

export interface TileRef {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly id: number;
}

export function parseBounds(text: string): Bounds {
  const parts = text.split(',').map(Number);
  const [west, south, east, north] = parts;
  if (
    parts.length !== 4 ||
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    parts.some((part) => !Number.isFinite(part)) ||
    west >= east ||
    south >= north
  ) {
    throw new Error(`not WEST,SOUTH,EAST,NORTH: ${text}`);
  }
  return [west, south, east, north];
}

/** The column and row of the tile holding a point at zoom `z`. */
export function tileOf(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const radians = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * n,
  );
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))];
}

/** Every tile of the area from `minZoom` to `maxZoom`, in the order of their IDs, as an archive keeps them. */
export function tilesOf(
  [west, south, east, north]: Bounds,
  minZoom: number,
  maxZoom: number,
): TileRef[] {
  const tiles: TileRef[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const [left, top] = tileOf(west, north, z);
    const [right, bottom] = tileOf(east, south, z);
    for (let x = left; x <= right; x++) {
      for (let y = top; y <= bottom; y++) tiles.push({ z, x, y, id: zxyToTileId(z, x, y) });
    }
  }
  return tiles.sort((a, b) => a.id - b.id);
}
