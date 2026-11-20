import { VectorTile } from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import { fromVectorTileJs, type VectorTileFeatureLike } from '@maplibre/vt-pbf';
import { PbfReader } from 'pbf';
import { describe, expect, it } from 'vitest';

import { slimBuildings } from './slim-buildings.ts';

/** A square building with these properties, as Overture's tiles carry one. */
function building(properties: Record<string, string | number | boolean>): VectorTileFeatureLike {
  return {
    type: 3,
    id: 7,
    extent: 4096,
    properties,
    loadGeometry: () => [
      [
        new Point(10, 10),
        new Point(100, 10),
        new Point(100, 100),
        new Point(10, 100),
        new Point(10, 10),
      ],
    ],
  };
}

function tile(features: VectorTileFeatureLike[]): Uint8Array {
  return fromVectorTileJs({
    layers: {
      building: {
        version: 2,
        name: 'building',
        extent: 4096,
        length: features.length,
        feature: (index) => {
          const feature = features[index];
          if (feature === undefined) throw new Error('no feature');
          return feature;
        },
      },
    },
  });
}

describe('a buildings tile kept light', () => {
  it('keeps the outline, height, floors, kind and source, and nothing else', () => {
    const light = slimBuildings(
      tile([
        building({
          height: 23,
          num_floors: 7,
          class: 'apartments',
          '@geometry_source': 'OpenStreetMap',
          id: '08b39...',
          sources: '[{"dataset":"OpenStreetMap"}]',
          roof_shape: 'flat',
        }),
      ]),
    );
    if (light === null) throw new Error('no tile');
    const layer = new VectorTile(new PbfReader(light)).layers['building'];
    const feature = layer?.feature(0);
    expect({ ...feature?.properties }).toEqual({
      height: 23,
      num_floors: 7,
      class: 'apartments',
      '@geometry_source': 'OpenStreetMap',
    });
    expect(feature?.loadGeometry()[0]).toHaveLength(5);
    expect(feature?.id).toBeUndefined();
  });

  it('leaves out buildings underground, and a tile with nothing else', () => {
    expect(slimBuildings(tile([building({ is_underground: true })]))).toBeNull();
  });
});
