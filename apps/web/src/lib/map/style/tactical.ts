// The tactical map's palette (ADR-0114, ADR-0120): the OpenStreetMap map all in greys on a dark
// ground, for the night and for a screen where only what the team marks should stand out. It is a
// base map of its own, whatever the app's look.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';

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
  water: '#0e161c',
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
  bridges_other_casing: '#0b0c0d',
  bridges_minor_casing: '#0b0c0d',
  bridges_link_casing: '#0b0c0d',
  bridges_major_casing: '#0b0c0d',
  bridges_highway_casing: '#0b0c0d',
  bridges_other: '#464b51',
  bridges_minor: '#5c6269',
  bridges_link: '#80868d',
  bridges_major: '#959ba2',
  bridges_highway: '#babfc4',
  roads_label_minor: '#7c8289',
  roads_label_minor_halo: '#0f1011',
  roads_label_major: '#9ca2a8',
  roads_label_major_halo: '#0f1011',
  ocean_label: '#5d7584',
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

export function tacticalFlavor(): Flavor {
  return { ...namedFlavor('dark'), ...TACTICAL_PALETTE };
}
