// The buildings of the vector maps (ADR-0161): Overture Maps', from our own archive (tiles/
// sources.ts), drawn where the base map drew OpenStreetMap's and in its colours. Overture's hold
// OpenStreetMap's and add those of the national mapping agencies and those found in aerial
// imagery, so a building is drawn once, from whichever source has it.

import type {
  ExpressionSpecification,
  LayerSpecification,
  LineLayerSpecification,
  SourceSpecification,
} from 'maplibre-gl';

import { tileUrlTemplate } from '../tiles/protocol.ts';
import { BUILDINGS_ATTRIBUTION, BUILDINGS_MAX_ZOOM, BUILDINGS_MIN_ZOOM } from '../tiles/sources.ts';

export const BUILDINGS_SOURCE = 'buildings';
/** The archive's layer (apps/server/src/maps/slim-buildings.ts). */
const BUILDING_LAYER = 'building';

/** The base map's layer of buildings, which this one takes the place and the colours of. */
const BASEMAP_BUILDINGS = 'buildings';

export function buildingsSource(): SourceSpecification {
  return {
    type: 'vector',
    tiles: [tileUrlTemplate('buildings')],
    minzoom: BUILDINGS_MIN_ZOOM,
    maxzoom: BUILDINGS_MAX_ZOOM,
    attribution: BUILDINGS_ATTRIBUTION,
  };
}

/** The base map's ground, its buildings read from the buildings archive. */
export function withBuildings(ground: readonly LayerSpecification[]): LayerSpecification[] {
  return ground.map((layer) =>
    layer.id === BASEMAP_BUILDINGS && layer.type === 'fill'
      ? {
          id: layer.id,
          type: 'fill',
          source: BUILDINGS_SOURCE,
          'source-layer': BUILDING_LAYER,
          ...(layer.paint ? { paint: layer.paint } : {}),
        }
      : layer,
  );
}

/** The outlines of the buildings, from close up. */
export function buildingEdges(paint: LineLayerSpecification['paint']): LayerSpecification {
  return {
    id: 'buildings-edge',
    type: 'line',
    source: BUILDINGS_SOURCE,
    'source-layer': BUILDING_LAYER,
    minzoom: 15,
    ...(paint ? { paint } : {}),
  };
}

/**
 * How high a building stands, in metres: its height where it is known, else three metres a floor,
 * else three floors.
 */
const HEIGHT: ExpressionSpecification = [
  'case',
  ['has', 'height'],
  ['get', 'height'],
  ['has', 'num_floors'],
  ['*', ['get', 'num_floors'], 3],
  9,
];

/** Each building raised to its height, over the streets and under the names. */
export function raisedBuildings(colour: string): LayerSpecification {
  return {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: BUILDINGS_SOURCE,
    'source-layer': BUILDING_LAYER,
    minzoom: 15,
    paint: {
      'fill-extrusion-color': colour,
      'fill-extrusion-height': HEIGHT,
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.85],
    },
  };
}
