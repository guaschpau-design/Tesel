// What IGN's vector map of Spain adds to the topographic and urban maps (ADR-0139): every building
// of the cadastre, where OpenStreetMap often misses whole streets of them, and the official house
// numbers (CartoCiudad's), from zoom 16. In Spain they take the place of OpenStreetMap's on the flat
// map (one-layer-of-buildings.ts, ADR-0149), which stay for the rest of Europe and, raised in 3D,
// for their heights; outside Spain IGN's tiles are empty.

import type { LayerSpecification } from 'maplibre-gl';

import { themeColor } from '../../ui/theme.ts';

/** The layers of IGN's tiles read here. */
const BUILDINGS = 'edificio_pol';
const HOUSE_NUMBERS = 'portal_pto';

/** From this zoom the cadastre's buildings are drawn. */
export const CADASTRE_MIN_ZOOM = 15;

/** Buildings of the cadastre without a height are raised to two floors, below OpenStreetMap's. */
const RAISED_METRES = 7;

/** How a map draws the cadastre's buildings: its buildings' colour, and an edge if it has one. */
export interface BuildingLook {
  readonly fill: string;
  readonly edge: string | null;
}

export function cadastreBuildingLayers(source: string, look: BuildingLook): LayerSpecification[] {
  const common = { source, 'source-layer': BUILDINGS, minzoom: CADASTRE_MIN_ZOOM } as const;
  return [
    { ...common, id: 'cadastre-buildings', type: 'fill', paint: { 'fill-color': look.fill } },
    ...(look.edge === null
      ? []
      : [
          {
            ...common,
            id: 'cadastre-buildings-edge',
            type: 'line',
            paint: { 'line-color': look.edge, 'line-width': 0.6 },
          } satisfies LayerSpecification,
        ]),
  ];
}

/** The cadastre's buildings raised, with the ground in 3D, for those OpenStreetMap does not hold. */
export function raisedCadastreBuildings(source: string, colour: string): LayerSpecification {
  return {
    id: 'cadastre-buildings-3d',
    type: 'fill-extrusion',
    source,
    'source-layer': BUILDINGS,
    minzoom: CADASTRE_MIN_ZOOM,
    paint: {
      'fill-extrusion-color': colour,
      'fill-extrusion-height': RAISED_METRES,
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.85],
    },
  };
}

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
