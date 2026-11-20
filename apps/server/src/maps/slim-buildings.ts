// The buildings of a tile of Overture's buildings archive, kept light for Tesel (ADR-0161): only
// the buildings above ground, and of what is known of each only what the app reads (map/style/
// buildings.ts): its height, its floors above ground, its kind and where its outline comes from.
// Overture's tiles carry much more (names, roofs, facades, every source's record), which weighs
// some four times what the outlines do, in every area downloaded.

import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { fromVectorTileJs, type VectorTileFeatureLike } from '@maplibre/vt-pbf';
import { PbfReader } from 'pbf';

export const BUILDING_LAYER = 'building';

/** What is kept of each building, as the archive's metadata describes it. */
export const BUILDING_FIELDS = {
  height: 'Number',
  num_floors: 'Number',
  class: 'String',
  '@geometry_source': 'String',
} as const;

const KEPT = Object.keys(BUILDING_FIELDS);

function slim(feature: VectorTileFeature): VectorTileFeatureLike {
  const properties = Object.fromEntries(
    Object.entries(feature.properties).filter(([key]) => KEPT.includes(key)),
  );
  return {
    type: feature.type,
    id: undefined,
    extent: feature.extent,
    properties,
    loadGeometry: () => feature.loadGeometry(),
  };
}

/** A tile with the buildings kept light, uncompressed; null if it has none above ground. */
export function slimBuildings(tile: Uint8Array): Uint8Array | null {
  const layer = new VectorTile(new PbfReader(tile)).layers[BUILDING_LAYER];
  if (layer === undefined) return null;
  const features: VectorTileFeatureLike[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (feature.properties['is_underground'] !== true) features.push(slim(feature));
  }
  if (features.length === 0) return null;
  return fromVectorTileJs({
    layers: {
      [BUILDING_LAYER]: {
        version: layer.version,
        name: BUILDING_LAYER,
        extent: layer.extent,
        length: features.length,
        feature: (index) => {
          const feature = features[index];
          if (feature === undefined) throw new Error(`no building ${String(index)}`);
          return feature;
        },
      },
    },
  });
}
