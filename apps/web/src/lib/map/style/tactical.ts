// The tactical map (ADR-0114, ADR-0120, ADR-0141, ADR-0144): the OpenStreetMap map in coyote, the
// sand of military kit, read as a military map is. The ground has its shape (relief and contour
// lines), water its blue, woods a texture of cover; roads are dark on the sand, bridges edged in
// black; place names are in capitals. It is a base map of its own, whatever the app's look.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';

import { HUT_IMAGE, type HutLook, type PedestrianLook, type TrailLook } from './trails.ts';

/**
 * What the tactical map draws apart from the base map's palette: the woods'
 * texture and a stream's flow (images made by terrain-images.ts, in their inks), the streams, the
 * ways off the streets, pedestrian streets and huts (ADR-0145).
 */
export interface TacticalLook {
  readonly images: { readonly woods: string; readonly flow: string };
  readonly inks: { readonly woods: string; readonly flow: string; readonly edge: string };
  readonly stream: string;
  readonly trails: TrailLook;
  readonly pedestrian: PedestrianLook;
  readonly huts: HutLook;
}

export const TACTICAL_LOOK: TacticalLook = {
  images: { woods: 'tactical-woods', flow: 'tactical-flow' },
  inks: { woods: 'rgba(70, 82, 40, 0.4)', flow: '#2c6a8a', edge: 'rgba(255, 248, 230, 0.85)' },
  stream: '#3c7a99',
  // Tracks in dark brown dashes, footpaths and steps in black dots and bars, as on a military map.
  trails: { track: '#3a2e22', footpath: '#1f1a14', halo: 'rgba(241, 232, 208, 0.7)' },
  // Pedestrian streets as the other streets: light on brown edges.
  pedestrian: { line: '#f4ecd6', casing: '#7a6a52' },
  huts: { image: HUT_IMAGE, name: '#3a2e22' },
};

/** Bridges' edges: where a way crosses water or a valley, a point every crossing depends on. */
const BRIDGE = '#1f1a14';

/** The same colour for the four edges of a road's rank. */
function casings(colour: string): Partial<Flavor> {
  return {
    highway_casing_early: colour,
    highway_casing_late: colour,
    major_casing_early: colour,
    major_casing_late: colour,
    link_casing: colour,
  };
}

/**
 * Coyote land, the sand of military kit, with woods in olive and water in a grey blue; roads dark
 * brown on light edges, the more important the darker, streets light on brown edges; buildings
 * dark; names black on a sand halo (ADR-0144).
 */
const COYOTE_PALETTE: Partial<Flavor> = {
  background: '#d9cdae',
  earth: '#d9cdae',
  park_a: '#bfc195',
  park_b: '#bfc195',
  wood_a: '#a9b07f',
  wood_b: '#a9b07f',
  scrub_a: '#c9c49c',
  scrub_b: '#c9c49c',
  pedestrian: '#e3d9bf',
  landcover: {
    grassland: 'rgba(205, 197, 160, 1)',
    barren: 'rgba(222, 210, 180, 1)',
    urban_area: 'rgba(201, 186, 160, 1)',
    farmland: 'rgba(214, 203, 170, 1)',
    glacier: 'rgba(240, 240, 240, 1)',
    scrub: 'rgba(201, 196, 156, 1)',
    forest: 'rgba(169, 176, 127, 1)',
  },
  water: '#7fa7b8',
  buildings: '#5a4e3c',
  highway: '#3a2e22',
  major: '#5a4632',
  link: '#5a4632',
  ...casings('#f1e8d0'),
  minor_a: '#f4ecd6',
  minor_b: '#f4ecd6',
  minor_casing: '#7a6a52',
  minor_service: '#efe6cc',
  minor_service_casing: '#8a7a60',
  other: '#6b5a42',
  railway: '#222222',
  bridges_other_casing: BRIDGE,
  bridges_minor_casing: BRIDGE,
  bridges_link_casing: BRIDGE,
  bridges_major_casing: BRIDGE,
  bridges_highway_casing: BRIDGE,
  city_label: '#1f1a14',
  city_label_halo: '#e6dbbd',
  subplace_label: '#3e3222',
  subplace_label_halo: '#e6dbbd',
  roads_label_minor: '#2b2218',
  roads_label_minor_halo: '#f1e8d0',
  roads_label_major: '#1f1a14',
  roads_label_major_halo: '#f1e8d0',
  ocean_label: '#2c6a8a',
};

export function tacticalFlavor(): Flavor {
  return { ...namedFlavor('light'), ...COYOTE_PALETTE };
}

/** The names a military map writes in capitals: places, water and the terrain. */
function inCapitals(id: string): boolean {
  return id.startsWith('places_') || id.startsWith('water') || id === 'terrain-names';
}

/**
 * Names of places, water and the terrain in capitals and spaced, as military maps write them;
 * streets keep their names as they are signed.
 */
export function tacticalNames(names: readonly LayerSpecification[]): LayerSpecification[] {
  return names.map((layer) =>
    layer.type === 'symbol' && inCapitals(layer.id)
      ? {
          ...layer,
          layout: { ...layer.layout, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
        }
      : layer,
  );
}
