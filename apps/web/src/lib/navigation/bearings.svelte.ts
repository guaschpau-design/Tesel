// How bearings are written everywhere in the app (ADR-0145): degrees or NATO mils, from true
// north or from magnetic north for a compass. Both are preferences; the declination is the one at
// the centre of the map, which is where bearings are read, and it changes by a degree only over
// hundreds of kilometres.

import type { LatLon } from '@tesel/protocol';
import type { Map as MapLibreMap } from 'maplibre-gl';

import type { BearingStyle } from '../format.ts';
import { decimalYear, declination } from './declination.ts';

export const BEARING_UNITS = ['degrees', 'mils'] as const;
export type BearingUnit = (typeof BEARING_UNITS)[number];

export const NORTHS = ['true', 'magnetic'] as const;
export type North = (typeof NORTHS)[number];

/** The declination is worked out again only when the map moves this far, in degrees. */
const STEP = 0.1;

class Bearings {
  #unit: () => BearingUnit = $state.raw(() => 'degrees');
  #north: () => North = $state.raw(() => 'true');
  /** The declination at the map's centre, once the map has one. */
  #declination: number | null = $state(null);
  #where = '';

  /** How bearings are written now. */
  get style(): BearingStyle {
    const magnetic = this.#north() === 'magnetic' && this.#declination !== null;
    return { unit: this.#unit(), declination: magnetic ? this.#declination : null };
  }

  /** The declination at the map's centre, east positive; null before the map has a centre. */
  get declination(): number | null {
    return this.#declination;
  }

  /** Follows the unit and the north that `unit` and `north` read, until the returned function. */
  follow(unit: () => BearingUnit, north: () => North): () => void {
    this.#unit = unit;
    this.#north = north;
    return () => {
      this.#unit = () => 'degrees';
      this.#north = () => 'true';
    };
  }

  /** Where bearings are read from now: the centre of the map. */
  placeAt(at: LatLon): void {
    const where = `${String(Math.round(at.lat / STEP))}/${String(Math.round(at.lon / STEP))}`;
    if (where === this.#where) return;
    this.#where = where;
    this.#declination = declination(at, decimalYear(new Date()));
  }
}

/** How bearings are written, which every card, label and the radar share. */
export const bearings = new Bearings();

/** Keeps the declination that of the map's centre, until the returned function is called. */
export function followMapCentre(map: MapLibreMap): () => void {
  const update = () => {
    const centre = map.getCenter();
    bearings.placeAt({ lat: centre.lat, lon: centre.lng });
  };
  update();
  map.on('moveend', update);
  return () => {
    map.off('moveend', update);
  };
}
