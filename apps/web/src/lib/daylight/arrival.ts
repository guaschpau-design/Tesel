// Whether there will be light on arriving somewhere (ADR-0157): by day, with little light left, or
// by night; and, for a point, the next change of the light there.

import type { LatLon } from '@tesel/protocol';

import { lightOfDay, nextSunChanges, sunIsUp } from './sky.ts';

/** Less light than this left on arriving, the way back is in the dark. */
const LITTLE_LIGHT_MIN = 30;
const MINUTE = 60_000;

export type ArrivalLight =
  | { readonly kind: 'day' }
  /** With `minutes` of light left before the sun sets at `sunset`. */
  | { readonly kind: 'dim'; readonly minutes: number; readonly sunset: number }
  /** After the sun has set at `sunset`, or before it rises at `sunrise`. */
  | { readonly kind: 'night'; readonly sunset: number | null; readonly sunrise: number | null };

/** The light on arriving at `at` at `arrival`, having set out at `now`. */
export function arrivalLight(at: LatLon, now: number, arrival: number): ArrivalLight {
  if (sunIsUp(at, arrival)) {
    const { down } = nextSunChanges(at, arrival);
    const minutes = down === null ? Infinity : (down - arrival) / MINUTE;
    return down !== null && minutes < LITTLE_LIGHT_MIN
      ? { kind: 'dim', minutes: Math.max(1, Math.round(minutes)), sunset: down }
      : { kind: 'day' };
  }
  const fromNow = nextSunChanges(at, now);
  // Set out by day, the sun sets on the way; set out by night, it rises after arriving.
  const sunset = sunIsUp(at, now) ? fromNow.down : null;
  return {
    kind: 'night',
    sunset,
    sunrise: sunset === null ? nextSunChanges(at, arrival).up : null,
  };
}

/** What changes next at `at` after `now`: the sun sets, then last light; or it rises. */
export type NextLight =
  | { readonly kind: 'sets'; readonly sunset: number; readonly dusk: number | null }
  | { readonly kind: 'rises'; readonly sunrise: number }
  /** A polar day or night: nothing changes within a day. */
  | { readonly kind: 'none' };

export function nextLight(at: LatLon, now: number): NextLight {
  const { up, down } = nextSunChanges(at, now);
  if (sunIsUp(at, now)) {
    if (down === null) return { kind: 'none' };
    const { dusk } = lightOfDay(at, down);
    return { kind: 'sets', sunset: down, dusk };
  }
  return up === null ? { kind: 'none' } : { kind: 'rises', sunrise: up };
}
