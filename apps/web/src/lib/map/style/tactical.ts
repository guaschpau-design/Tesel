// The tactical map (ADR-0114, ADR-0120, ADR-0141, ADR-0144): the OpenStreetMap map in coyote, the
// sand of military kit, read as a military map is. The ground has its shape (relief and contour
// lines), water its blue, woods a texture of cover; roads are dark on the sand, bridges edged in
// black; place names are in capitals. The night map is the same map on graphite, turned into reds
// on black. Each is a base map of its own, whatever the app's look.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';

import type { BuildingLook } from './cadastre.ts';
import { HUT_IMAGE, type HutLook, type PedestrianLook, type TrailLook } from './trails.ts';

/** Day, the tactical map in coyote; night, the night map in reds. */
export type TacticalTime = 'day' | 'night';

/**
 * What the tactical maps draw apart from the base map's palette, by day and by night: the woods'
 * texture and a stream's flow (images made by terrain-images.ts, in their inks), the streams, the
 * ways off the streets, pedestrian streets, huts and the cadastre's buildings (ADR-0145).
 */
export interface TacticalLook {
  readonly images: { readonly woods: string; readonly flow: string };
  readonly inks: { readonly woods: string; readonly flow: string; readonly edge: string };
  readonly stream: string;
  readonly trails: TrailLook;
  readonly pedestrian: PedestrianLook;
  readonly huts: HutLook;
  readonly buildings: BuildingLook;
}

export const TACTICAL_LOOKS: Readonly<Record<TacticalTime, TacticalLook>> = {
  day: {
    images: { woods: 'tactical-woods', flow: 'tactical-flow' },
    inks: { woods: 'rgba(70, 82, 40, 0.4)', flow: '#2c6a8a', edge: 'rgba(255, 248, 230, 0.85)' },
    stream: '#3c7a99',
    // Tracks in dark brown dashes, footpaths and steps in black dots and bars, as on a military map.
    trails: { track: '#3a2e22', footpath: '#1f1a14', halo: 'rgba(241, 232, 208, 0.7)' },
    // Pedestrian streets as the other streets: light on brown edges.
    pedestrian: { line: '#f4ecd6', casing: '#7a6a52' },
    huts: { image: HUT_IMAGE, name: '#3a2e22' },
    buildings: { fill: '#5a4e3c', edge: null },
  },
  night: {
    images: { woods: 'night-woods', flow: 'night-flow' },
    inks: { woods: 'rgba(150, 30, 30, 0.45)', flow: '#c0392b', edge: 'rgba(0, 0, 0, 0.8)' },
    stream: '#7a1c1c',
    trails: { track: '#8f2626', footpath: '#a33a3a', halo: 'rgba(0, 0, 0, 0.6)' },
    pedestrian: { line: inRed('#5c6269'), casing: inRed('#0f1011') },
    huts: { image: 'night-hut', name: '#a33a3a' },
    buildings: { fill: inRed('#232529'), edge: null },
  },
};

/** Bridges' edges: where a way crosses water or a valley, a point every crossing depends on. */
const BRIDGE = '#1f1a14';
/** On the graphite the night map starts from, bridges' edges are light, to turn into a bright red. */
const NIGHT_BRIDGE = '#c98a1e';

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

/**
 * The night map's ground before it is turned into reds (ADR-0114, ADR-0141): graphite land, and
 * every line in greys that grow lighter with the road's rank; water and green areas barely tinted.
 * The roads stand well clear of the land and the buildings: against the land, a contrast of 3:1
 * for a street, 6.5:1 for a main road and 10:1 for a motorway.
 */
const GRAPHITE_PALETTE: Partial<Flavor> = {
  background: '#0e161c',
  earth: '#141516',
  park_a: '#161d18',
  park_b: '#18201a',
  hospital: '#1b1a1b',
  industrial: '#171819',
  school: '#1a1a19',
  wood_a: '#151c17',
  wood_b: '#151c17',
  pedestrian: '#18191b',
  scrub_a: '#171b16',
  scrub_b: '#171b16',
  glacier: '#1d2023',
  sand: '#1b1a17',
  beach: '#1d1c19',
  aerodrome: '#18191b',
  runway: '#2b2e32',
  water: '#0f2a3d',
  zoo: '#161d18',
  military: '#1a1918',
  landcover: {
    grassland: 'rgba(23, 28, 23, 1)',
    barren: 'rgba(27, 27, 25, 1)',
    urban_area: 'rgba(24, 25, 27, 1)',
    farmland: 'rgba(24, 27, 23, 1)',
    glacier: 'rgba(32, 35, 38, 1)',
    scrub: 'rgba(24, 27, 22, 1)',
    forest: 'rgba(21, 28, 23, 1)',
  },
  buildings: '#232529',
  pier: '#2b2e32',
  tunnel_other_casing: '#0b0c0d',
  tunnel_minor_casing: '#0b0c0d',
  tunnel_link_casing: '#0b0c0d',
  tunnel_major_casing: '#0b0c0d',
  tunnel_highway_casing: '#0b0c0d',
  tunnel_other: '#30343a',
  tunnel_minor: '#30343a',
  tunnel_link: '#3e4248',
  tunnel_major: '#43484e',
  tunnel_highway: '#50555c',
  other: '#464b51',
  minor_service: '#464b51',
  minor_service_casing: '#0f1011',
  minor_a: '#5c6269',
  minor_b: '#565c63',
  minor_casing: '#0f1011',
  link: '#80868d',
  link_casing: '#0f1011',
  major: '#959ba2',
  major_casing_early: '#0f1011',
  major_casing_late: '#0f1011',
  highway: '#babfc4',
  highway_casing_early: '#0f1011',
  highway_casing_late: '#0f1011',
  railway: '#6d7278',
  boundaries: '#4b5158',
  bridges_other_casing: NIGHT_BRIDGE,
  bridges_minor_casing: NIGHT_BRIDGE,
  bridges_link_casing: NIGHT_BRIDGE,
  bridges_major_casing: NIGHT_BRIDGE,
  bridges_highway_casing: NIGHT_BRIDGE,
  bridges_other: '#464b51',
  bridges_minor: '#5c6269',
  bridges_link: '#80868d',
  bridges_major: '#959ba2',
  bridges_highway: '#babfc4',
  roads_label_minor: '#7c8289',
  roads_label_minor_halo: '#0f1011',
  roads_label_major: '#9ca2a8',
  roads_label_major_halo: '#0f1011',
  ocean_label: '#6aa6d4',
  subplace_label: '#8b9198',
  subplace_label_halo: '#0f1011',
  city_label: '#c6cacd',
  city_label_halo: '#0f1011',
  state_label: '#5f656b',
  state_label_halo: '#0f1011',
  country_label: '#8b9198',
  address_label: '#6b7177',
  address_label_halo: '#0f1011',
};

export function tacticalFlavor(night: boolean): Flavor {
  return night
    ? inRed({ ...namedFlavor('dark'), ...GRAPHITE_PALETTE })
    : { ...namedFlavor('light'), ...COYOTE_PALETTE };
}

/**
 * Every colour of a palette as a red of the same lightness on black: what is light stays light, so
 * the map reads as by day, without a colour that would dazzle eyes used to the dark.
 */
export function inRed<T>(palette: T): T {
  return JSON.parse(JSON.stringify(palette), (_key, value: unknown) =>
    typeof value === 'string' ? redOf(value) : value,
  ) as T;
}

function redOf(colour: string): string {
  const parts = channels(colour);
  if (parts === null) return colour;
  const [red, green, blue, alpha] = parts;
  const lightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const channel = (factor: number) => Math.min(255, Math.round(lightness * factor));
  return `rgba(${String(channel(1.15))}, ${String(channel(0.2))}, ${String(channel(0.16))}, ${String(alpha)})`;
}

/** Red, green, blue and alpha of a colour written as #rgb, #rrggbb or rgb()/rgba(); else null. */
function channels(colour: string): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    const value = Number.parseInt(full, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }
  const numbers = /^rgba?\(([^)]+)\)$/i.exec(colour)?.[1]?.split(',').map(Number);
  if (numbers === undefined || numbers.length < 3 || numbers.some(Number.isNaN)) return null;
  const [red = 0, green = 0, blue = 0, alpha = 1] = numbers;
  return [red, green, blue, alpha];
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
