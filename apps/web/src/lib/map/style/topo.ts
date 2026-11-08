// The topographic map (ADR-0034, ADR-0037), Tesel's base map (ADR-0120): the OpenStreetMap map in
// a palette that lets the land show, under contour lines worked out from the elevation
// (contours.ts), each index line carrying its height, and, in Spain, IGN's names of the terrain —
// mountains, ravines, places, caves — and of springs.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

import { themeColor } from '../../ui/theme.ts';
import { CONTOUR_LAYER, HEIGHT_KEY, RANK_KEY } from './contours.ts';

/** The style's names for the contour lines and for IGN's vector map. */
export const CONTOURS_SOURCE = 'contours';
export const NAMES_SOURCE = 'ign-names';

/**
 * Changes to Protomaps' light palette: woods and scrub greener than parks, which are only lines on
 * a plan, and tracks and paths brown, as topographic maps draw them.
 */
const TOPO_PALETTE: Partial<Flavor> = {
  background: '#efebe2',
  earth: '#efebe2',
  park_a: '#e6ebdb',
  park_b: '#dde7d0',
  wood_a: '#dde8d2',
  wood_b: '#c8dfb6',
  scrub_a: '#e6eadb',
  scrub_b: '#dce5cc',
  other: '#a8754c',
  landcover: {
    grassland: 'rgba(228, 236, 214, 1)',
    barren: 'rgba(240, 233, 216, 1)',
    urban_area: 'rgba(230, 228, 224, 1)',
    farmland: 'rgba(236, 238, 222, 1)',
    glacier: 'rgba(255, 255, 255, 1)',
    scrub: 'rgba(229, 234, 212, 1)',
    forest: 'rgba(207, 226, 193, 1)',
  },
};

export function topoFlavor(): Flavor {
  return { ...namedFlavor('light'), ...TOPO_PALETTE };
}

const isIndex: ExpressionSpecification = ['==', ['get', RANK_KEY], 1];

/** The contour lines, drawn over the relief shading and under every name. */
export function contourLayers(): LayerSpecification[] {
  const colour = themeColor('map-contour');
  const common = {
    type: 'line',
    source: CONTOURS_SOURCE,
    'source-layer': CONTOUR_LAYER,
  } as const;
  return [
    {
      ...common,
      id: 'contours',
      filter: ['!', isIndex],
      paint: {
        'line-color': colour,
        'line-opacity': 0.4,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 0.7],
      },
    },
    {
      ...common,
      id: 'contours-index',
      filter: isIndex,
      paint: {
        'line-color': colour,
        'line-opacity': 0.75,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 1.3],
      },
    },
  ];
}

/**
 * The heights of index lines, and the names of the terrain and of springs, under the OpenStreetMap
 * map's.
 */
export function terrainNameLayers(): LayerSpecification[] {
  const halo = themeColor('map-halo');
  const text = (colour: string) => ({
    'text-color': colour,
    'text-halo-color': halo,
    'text-halo-width': 1.4,
  });
  return [
    {
      id: 'contour-heights',
      type: 'symbol',
      source: CONTOURS_SOURCE,
      'source-layer': CONTOUR_LAYER,
      minzoom: 13,
      filter: isIndex,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['to-string', ['get', HEIGHT_KEY]],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-max-angle': 30,
        'text-padding': 8,
      },
      paint: text(themeColor('map-contour')),
    },
    {
      id: 'terrain-names',
      type: 'symbol',
      source: NAMES_SOURCE,
      'source-layer': 'nombre_orografia_pto',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 12],
        'text-max-width': 8,
        'text-padding': 4,
      },
      paint: text(themeColor('map-terrain')),
    },
    {
      id: 'spring-names',
      type: 'symbol',
      source: NAMES_SOURCE,
      'source-layer': 'nombre_hidrografia_pto',
      minzoom: 14,
      filter: ['==', ['get', 'clase'], 'surgencia'],
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 10.5,
        'text-max-width': 8,
      },
      paint: text(themeColor('map-spring')),
    },
  ];
}
