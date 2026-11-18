// The tactical map (ADR-0114, ADR-0120, ADR-0141): the OpenStreetMap map in greys on a dark ground,
// read as a military map is. The ground has its shape (relief and contour lines), water its blue,
// woods a texture of cover; bridges, where a way crosses water, stand out in amber; place names are
// in capitals. Its night version is the same map in reds on black. Each is a base map of its own,
// whatever the app's look.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';

/** The images of the woods' texture and of a stream's flow, by day and by night (terrain-images.ts). */
export const TACTICAL_IMAGES = {
  day: { woods: 'tactical-woods', flow: 'tactical-flow' },
  night: { woods: 'night-woods', flow: 'night-flow' },
} as const;

/** The colours those images are drawn in. */
export const TACTICAL_INKS = {
  day: { woods: 'rgba(120, 160, 128, 0.35)', flow: '#5aaee8', edge: 'rgba(0, 0, 0, 0.75)' },
  night: { woods: 'rgba(150, 30, 30, 0.45)', flow: '#c0392b', edge: 'rgba(0, 0, 0, 0.8)' },
} as const;

/** Bridges' edges: where a way crosses water or a valley, a point every crossing depends on. */
const BRIDGE = '#c98a1e';

/**
 * Graphite land, like the app's own dark surfaces, and every line in greys that grow lighter with
 * the road's rank, no colour of their own; water and green areas barely tinted. What the team
 * marks is all that has colour on it. The roads stand well clear of the land and the buildings:
 * against the land, a contrast of 3:1 for a street, 6.5:1 for a main road and 10:1 for a
 * motorway (ADR-0114).
 */
const TACTICAL_PALETTE: Partial<Flavor> = {
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
  bridges_other_casing: BRIDGE,
  bridges_minor_casing: BRIDGE,
  bridges_link_casing: BRIDGE,
  bridges_major_casing: BRIDGE,
  bridges_highway_casing: BRIDGE,
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
  const flavor = { ...namedFlavor('dark'), ...TACTICAL_PALETTE };
  return night ? inRed(flavor) : flavor;
}

/** The streams' blue by day; by night, a red. */
export function tacticalStream(night: boolean): string {
  return night ? '#7a1c1c' : '#2f78b0';
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
