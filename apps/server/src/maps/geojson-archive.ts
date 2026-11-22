// Writes features gathered from a service (build-aid-points.ts) as a PMTiles
// archive of vector tiles of one layer, at the zooms the app reads, so the app draws them as it
// draws the base map's own and keeps them in the areas downloaded for offline use. The features
// are cut into tiles by MapLibre's own tiler; only the tiles some feature reaches are written.

import { gzipSync } from 'node:zlib';

import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { zxyToTileId } from 'pmtiles';

import { tileOf, type Bounds } from './area.ts';
import { PmtilesWriter } from './pmtiles-writer.ts';

const EXTENT = 4096;
/** Beyond the tile's edge, in its units: lines and fills cut at the edge would show a seam. */
const BUFFER = 64;

export interface LayerArchive {
  /** The layer's name in the tiles, which the app's style reads. */
  readonly layer: string;
  /** The properties kept, by name, and their kind, as an archive's metadata describes them. */
  readonly fields: Readonly<Record<string, 'String' | 'Number' | 'Boolean'>>;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly bounds: Bounds;
  /** Name, description and attribution of the archive, and anything else worth recording. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Every position of a geometry, to find the tiles it reaches. */
function positions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(positions);
  }
}

/** The tiles at zoom `z` the bounding box of a feature reaches: their column and row, by tile ID. */
function reachedTiles(feature: Feature, z: number, into: Map<number, [number, number]>): void {
  // A loop, not Math.min(...): an outline can have more points than a call takes arguments.
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon = 0, lat = 0] of positions(feature.geometry)) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (west > east) return;
  const [left, top] = tileOf(west, north, z);
  const [right, bottom] = tileOf(east, south, z);
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) into.set(zxyToTileId(z, x, y), [x, y]);
  }
}

/** Writes the features to `path` as tiles of one layer; resolves to how many tiles hold some. */
export async function writeLayerArchive(
  path: string,
  features: FeatureCollection,
  archive: LayerArchive,
): Promise<number> {
  const index = new GeoJSONVT(features, {
    maxZoom: archive.maxZoom,
    indexMaxZoom: archive.minZoom,
    extent: EXTENT,
    buffer: BUFFER,
    tolerance: 3,
  });
  const writer = await PmtilesWriter.create(path);
  for (let z = archive.minZoom; z <= archive.maxZoom; z++) {
    const reached = new Map<number, [number, number]>();
    for (const feature of features.features) reachedTiles(feature, z, reached);
    for (const [id, [x, y]] of [...reached].sort(([a], [b]) => a - b)) {
      const tile = index.getTile(z, x, y);
      if (tile === null || tile.features.length === 0) continue;
      await writer.add(
        id,
        gzipSync(fromGeojsonVt({ [archive.layer]: tile }, { version: 2, extent: EXTENT })),
      );
    }
  }
  await writer.finish({
    minZoom: archive.minZoom,
    maxZoom: archive.maxZoom,
    bounds: archive.bounds,
    centerZoom: archive.minZoom,
    metadata: {
      ...archive.metadata,
      type: 'overlay',
      vector_layers: [
        {
          id: archive.layer,
          fields: archive.fields,
          minzoom: archive.minZoom,
          maxzoom: archive.maxZoom,
        },
      ],
    },
  });
  return writer.tiles;
}
