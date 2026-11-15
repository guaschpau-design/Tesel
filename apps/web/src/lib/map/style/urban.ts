// The urban map (ADR-0137): the OpenStreetMap map for an operation in a town, in daylight. Light,
// neutral greys, so that what the team marks stands out; the street names large and dark from a
// neighbourhood's zoom, house numbers close up, one-way arrows, blocks of buildings with their edge
// and, with the ground raised in 3D, each building raised to its height. No contour lines, relief
// shading or trees: in a town they only get in the way.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

import { themeColor } from '../../ui/theme.ts';
import type { PedestrianLook } from './trails.ts';

const BUILDING = '#d4d0c8';
const BUILDING_EDGE = '#a9a39a';
const STREET_NAME = '#2f3337';

/** Neutral land, buildings darker than it, streets white on a casing that stands out. */
const URBAN_PALETTE: Partial<Flavor> = {
  background: '#e7e5e0',
  earth: '#e7e5e0',
  minor_a: '#ffffff',
  minor_b: '#ffffff',
  buildings: BUILDING,
  park_a: '#e3eadf',
  park_b: '#d9e4d3',
  wood_a: '#dfe6da',
  wood_b: '#d6e0cf',
  pedestrian: '#e2dfeb',
  minor_casing: '#c4c0b8',
  minor_service_casing: '#cfcbc4',
  roads_label_minor: STREET_NAME,
  roads_label_major: STREET_NAME,
};

/**
 * Pedestrian streets apart from the others, in a lilac grey as OpenStreetMap's map draws them:
 * where a vehicle cannot go, and people gather (ADR-0138).
 */
export const URBAN_PEDESTRIAN: PedestrianLook = { line: '#dcd9e8', casing: '#a9a5bd' };

export function urbanFlavor(): Flavor {
  return { ...namedFlavor('light'), ...URBAN_PALETTE };
}

/** From a neighbourhood's zoom to a street's, the size street names grow to. */
const STREET_NAME_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14,
  11,
  16,
  13.5,
  18,
  16,
];

/**
 * The base map's ground and names, made for a town: buildings edged, street names larger and
 * from a neighbourhood's zoom, house numbers from zoom 17 rather than 18.
 */
export function urbanLayers(
  source: string,
  ground: readonly LayerSpecification[],
  names: readonly LayerSpecification[],
): { ground: LayerSpecification[]; names: LayerSpecification[] } {
  return {
    ground: ground.flatMap((layer) =>
      layer.id === 'buildings' ? [layer, buildingEdges(source)] : [layer],
    ),
    names: names.map((layer) => {
      if (layer.type !== 'symbol') return layer;
      if (layer.id === 'roads_labels_minor' || layer.id === 'roads_labels_major') {
        return {
          ...layer,
          minzoom: 14,
          layout: { ...layer.layout, 'text-size': STREET_NAME_SIZE },
          paint: {
            ...layer.paint,
            'text-halo-color': themeColor('map-halo'),
            'text-halo-width': 2,
          },
        };
      }
      // The arrows of one-way streets, larger: which way a vehicle may go.
      if (layer.id === 'roads_oneway') {
        return {
          ...layer,
          layout: {
            ...layer.layout,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 16, 1, 18, 1.6],
          },
        };
      }
      if (layer.id === 'address_label') {
        return {
          ...layer,
          minzoom: 17,
          layout: { ...layer.layout, 'text-size': 12 },
          paint: { ...layer.paint, 'text-color': STREET_NAME },
        };
      }
      return layer;
    }),
  };
}

function buildingEdges(source: string): LayerSpecification {
  return {
    id: 'buildings-edge',
    type: 'line',
    source,
    'source-layer': 'buildings',
    minzoom: 15,
    filter: ['in', ['get', 'kind'], ['literal', ['building', 'building_part']]],
    paint: { 'line-color': BUILDING_EDGE, 'line-width': 0.6 },
  };
}

/**
 * Each building raised to its height, where the map knows it, or to three floors where it does
 * not: over the streets, under the names.
 */
export function raisedBuildings(source: string): LayerSpecification {
  return {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source,
    'source-layer': 'buildings',
    minzoom: 15,
    filter: ['in', ['get', 'kind'], ['literal', ['building', 'building_part']]],
    paint: {
      'fill-extrusion-color': BUILDING,
      'fill-extrusion-height': ['coalesce', ['get', 'height'], 9],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.85],
    },
  };
}
