// What each base map shows when it is chosen (ADR-0160), as Pau set it: which of the map's own
// layers are on, and how bearings and coordinates are read. Everything can be changed again after.

import type { CoordinateFormat } from '../coordinates/coordinates.ts';
import type { BearingUnit, North } from '../navigation/bearings.svelte.ts';
import { MAP_FLAGS, type MapFlag, type MapLayer } from './layers.ts';
import type { BaseMap } from './style/style.ts';

/** Which base maps each layer is on for: the rest are off when a map is chosen. */
const ON_FOR: Readonly<Record<MapFlag | 'services' | 'weather', readonly BaseMap[]>> = {
  services: ['topo', 'urban', 'aerial', 'tactical'],
  weather: [],
  relief: ['topo', 'tactical'],
  slope: ['tactical'],
  cadastre: [],
  fires: ['topo'],
  floods: ['urban'],
  radar: ['urban', 'tactical'],
  grid: ['tactical'],
};

export interface MapDefaults {
  /** The map's own layers that are switches of their own, on or off. */
  readonly flags: Readonly<Record<MapFlag, boolean>>;
  /** The layers hidden at the user's wish, once the map's are shown or hidden as it wants. */
  readonly hidden: (hidden: readonly MapLayer[]) => MapLayer[];
  /** Bearings: in mils from magnetic north on the tactical map, in degrees from true north else. */
  readonly bearingUnit: BearingUnit;
  readonly north: North;
  /** Coordinates: MGRS on the tactical map; off it, what the user chose, unless that was MGRS. */
  readonly coordinates: (format: CoordinateFormat) => CoordinateFormat;
}

export function mapDefaults(base: BaseMap): MapDefaults {
  const tactical = base === 'tactical';
  const flags = Object.fromEntries(
    MAP_FLAGS.map((flag) => [flag, ON_FOR[flag].includes(base)]),
  ) as Record<MapFlag, boolean>;
  const shown = (layer: 'services' | 'weather') => ON_FOR[layer].includes(base);
  return {
    flags,
    hidden: (hidden) => [
      ...hidden.filter((layer) => layer !== 'services' && layer !== 'weather'),
      ...(['services', 'weather'] as const).filter((layer) => !shown(layer)),
    ],
    bearingUnit: tactical ? 'mils' : 'degrees',
    north: tactical ? 'magnetic' : 'true',
    coordinates: (format) => (tactical ? 'mgrs' : format === 'mgrs' ? 'decimal' : format),
  };
}
