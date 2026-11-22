import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VectorTile } from '@mapbox/vector-tile';
import type { FeatureCollection } from 'geojson';
import { PbfReader } from 'pbf';
import { PMTiles, type Source } from 'pmtiles';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tileOf } from './area.ts';
import { writeLayerArchive } from './geojson-archive.ts';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'layer-archive-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

let archives = 0;
function inMemory(bytes: Buffer): Source {
  const key = `layer-archive-${String(++archives)}`;
  return {
    getKey: () => key,
    getBytes: (offset, length) =>
      Promise.resolve({ data: Uint8Array.from(bytes.subarray(offset, offset + length)).buffer }),
  };
}

const VALENCIA: [number, number] = [-0.3763, 39.4699];
const FEATURES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: VALENCIA },
      properties: { kind: 'defibrillator', name: 'Ayuntamiento' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.5, 39.4],
            [-0.3, 39.4],
            [-0.3, 39.6],
            [-0.5, 39.6],
            [-0.5, 39.4],
          ],
        ],
      },
      properties: { kind: 'zone' },
    },
  ],
};

describe('a layer archive', () => {
  it('holds each feature in the tiles it reaches, at every zoom, and only those', async () => {
    const path = join(dir, 'layer.pmtiles');
    const tiles = await writeLayerArchive(path, FEATURES, {
      layer: 'point',
      fields: { kind: 'String', name: 'String' },
      minZoom: 12,
      maxZoom: 13,
      bounds: [-1, 39, 0, 40],
      metadata: { name: 'test', attribution: 'test' },
    });
    const archive = new PMTiles(inMemory(await readFile(path)));
    const header = await archive.getHeader();
    expect([header.minZoom, header.maxZoom]).toEqual([12, 13]);
    expect(
      ((await archive.getMetadata()) as { vector_layers: { id: string }[] }).vector_layers[0]?.id,
    ).toBe('point');

    const [x, y] = tileOf(...VALENCIA, 13);
    const found = await archive.getZxy(13, x, y);
    if (found === undefined) throw new Error('no tile where the point is');
    const layer = new VectorTile(new PbfReader(new Uint8Array(found.data))).layers['point'];
    const kinds = Array.from(
      { length: layer?.length ?? 0 },
      (_, index) => layer?.feature(index).properties['kind'],
    );
    expect(kinds.sort()).toEqual(['defibrillator', 'zone']);

    // The square of 0.2° reaches a handful of tiles at zoom 12, and more at 13; nothing far away.
    expect(tiles).toBeGreaterThan(4);
    expect(tiles).toBeLessThan(60);
    expect(await archive.getZxy(13, x + 20, y)).toBeUndefined();
  });
});
