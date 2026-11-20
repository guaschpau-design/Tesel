// The official house numbers of Spain (CartoCiudad's, in IGN's vector map, ADR-0139) on the urban
// map, from close up; outside Spain IGN's tiles are empty, and OpenStreetMap's own numbers show.

import type { LayerSpecification } from 'maplibre-gl';

import { themeColor } from '../../ui/theme.ts';

/** The layer of IGN's tiles read here. */
const HOUSE_NUMBERS = 'portal_pto';

/** The official house numbers, from close up: "23", "16 A". */
export function houseNumberLayer(source: string, colour: string): LayerSpecification {
  return {
    id: 'house-numbers',
    type: 'symbol',
    source,
    'source-layer': HOUSE_NUMBERS,
    minzoom: 17,
    layout: {
      'text-field': ['get', 'ref'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-padding': 2,
    },
    paint: {
      'text-color': colour,
      'text-halo-color': themeColor('map-halo'),
      'text-halo-width': 1.5,
    },
  };
}
