// Web Mercator tile arithmetic (XYZ scheme, as used by MapLibre and PMTiles), and the bounds it
// works on.

import type { LatLon } from '@tesel/protocol';

export interface Bounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface TileCoord {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** Web Mercator cannot represent the poles; latitudes are clamped to this value. */
const MAX_MERCATOR_LAT = 85.0511287798;

/**
 * Where a point falls on the grid of tiles at zoom `z`, counted in tiles from the world's top left
 * corner: the whole part names the tile, the fraction where in it the point lies.
 */
function gridPosition({ lat, lon }: LatLon, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const rad = (Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * The tile of a point at zoom `z`, and where in it the point lies, from 0 to 1 across (`u`) and
 * down (`v`). Points on the edges of the world fall in its edge tiles.
 */
export function tileAt(at: LatLon, z: number): { tile: TileCoord; u: number; v: number } {
  const { x, y } = gridPosition(at, z);
  const last = 2 ** z - 1;
  const tile = {
    z,
    x: Math.min(last, Math.max(0, Math.floor(x))),
    y: Math.min(last, Math.max(0, Math.floor(y))),
  };
  return { tile, u: x - tile.x, v: y - tile.y };
}

/** Inclusive tile ranges covering `bounds` at zoom `z`. Bounds must not cross the antimeridian. */
function tileRange(
  bounds: Bounds,
  z: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const topLeft = tileAt({ lat: bounds.north, lon: bounds.west }, z).tile;
  const bottomRight = tileAt({ lat: bounds.south, lon: bounds.east }, z).tile;
  return { minX: topLeft.x, maxX: bottomRight.x, minY: topLeft.y, maxY: bottomRight.y };
}

export function countTiles(bounds: Bounds, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    total += (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
  }
  return total;
}

/** Every tile covering `bounds` from `minZoom` to `maxZoom`, lowest zoom first. */
export function* tilesInBounds(
  bounds: Bounds,
  minZoom: number,
  maxZoom: number,
): Generator<TileCoord> {
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    for (let x = r.minX; x <= r.maxX; x++) {
      for (let y = r.minY; y <= r.maxY; y++) yield { z, x, y };
    }
  }
}

/** Where a point falls in a tile's square, from 0 to 1 across and down; outside it beyond. */
export function positionInTile(
  [lon, lat]: readonly [number, number],
  tile: TileCoord,
): [number, number] {
  const { x, y } = gridPosition({ lat, lon }, tile.z);
  return [x - tile.x, y - tile.y];
}

/** The longitudes and latitudes a tile covers. */
export function tileBounds({ z, x, y }: TileCoord): Bounds {
  const n = 2 ** z;
  const lon = (column: number) => (column / n) * 360 - 180;
  const lat = (row: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  return { west: lon(x), south: lat(y + 1), east: lon(x + 1), north: lat(y) };
}

export function tileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/** The world's edges, in degrees: ±180° of longitude and ±90° of latitude. */
const HALF_TURN = 180;
const QUARTER_TURN = 90;

/**
 * The smallest bounds around some points; they must not cross the antimeridian. Points beyond the
 * world's edges, as those worked out around a circle near a pole can be, are taken to the edge.
 */
export function boundsAround(points: readonly LatLon[]): Bounds {
  const clamp = (value: number, edge: number) => Math.min(edge, Math.max(-edge, value));
  return {
    west: clamp(Math.min(...points.map((point) => point.lon)), HALF_TURN),
    south: clamp(Math.min(...points.map((point) => point.lat)), QUARTER_TURN),
    east: clamp(Math.max(...points.map((point) => point.lon)), HALF_TURN),
    north: clamp(Math.max(...points.map((point) => point.lat)), QUARTER_TURN),
  };
}

/** Whether bounds are a place on the Earth: four numbers within the world's edges, west of east. */
export function isOnEarth({ west, south, east, north }: Bounds): boolean {
  return (
    -HALF_TURN <= west &&
    west <= east &&
    east <= HALF_TURN &&
    -QUARTER_TURN <= south &&
    south <= north &&
    north <= QUARTER_TURN
  );
}

/** Whether a point is within the bounds, edges included. */
export function containsPoint(bounds: Bounds, at: LatLon): boolean {
  return (
    at.lon >= bounds.west &&
    at.lon <= bounds.east &&
    at.lat >= bounds.south &&
    at.lat <= bounds.north
  );
}

/** Whether `outer` holds all of `inner`. */
export function containsBounds(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}
