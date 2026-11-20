// Where the sun and the moon are in the sky, worked out on the device with no data (ADR-0157):
// the low-precision formulas of the astronomical almanacs, as Vladimir Agafonkin's SunCalc gathers
// them, good to a minute for the sun and a few for the moon. When they rise and set, and when the
// light comes and goes, are found by following their height through the day.

import type { LatLon } from '@tesel/protocol';

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
/** The tilt of the earth's axis. */
const OBLIQUITY = RAD * 23.4397;
const SUN_DISTANCE_KM = 149_598_000;

/** Heights of the sun's centre, in degrees, at which the light changes. */
const SUN_RISE_SET = -0.833;
/** Nautical twilight: the ground can be told from the sky, and its shapes made out. */
const NAUTICAL = -12;
/** The moon's centre as it rises and sets, its size and the air's bending taken in. */
const MOON_RISE_SET = 0.133;

/** How finely the day is followed, in minutes: crossings between steps are interpolated. */
const STEP_MIN = 4;

function daysSince2000(time: number): number {
  return time / DAY_MS - 0.5 + J1970 - J2000;
}

function rightAscension(longitude: number, latitude: number): number {
  return Math.atan2(
    Math.sin(longitude) * Math.cos(OBLIQUITY) - Math.tan(latitude) * Math.sin(OBLIQUITY),
    Math.cos(longitude),
  );
}

function declination(longitude: number, latitude: number): number {
  return Math.asin(
    Math.sin(latitude) * Math.cos(OBLIQUITY) +
      Math.cos(latitude) * Math.sin(OBLIQUITY) * Math.sin(longitude),
  );
}

interface SkyPlace {
  /** Right ascension and declination, in radians. */
  readonly ra: number;
  readonly dec: number;
}

function sunPlace(days: number): SkyPlace {
  const anomaly = RAD * (357.5291 + 0.98560028 * days);
  const centre =
    RAD *
    (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly));
  const longitude = anomaly + centre + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(longitude, 0), dec: declination(longitude, 0) };
}

function moonPlace(days: number): SkyPlace & { readonly km: number } {
  const meanLongitude = RAD * (218.316 + 13.176396 * days);
  const anomaly = RAD * (134.963 + 13.064993 * days);
  const node = RAD * (93.272 + 13.22935 * days);
  const longitude = meanLongitude + RAD * 6.289 * Math.sin(anomaly);
  const latitude = RAD * 5.128 * Math.sin(node);
  return {
    ra: rightAscension(longitude, latitude),
    dec: declination(longitude, latitude),
    km: 385_001 - 20_905 * Math.cos(anomaly),
  };
}

/** The height above the horizon, in degrees, of a body at `place` seen from `at` at `time`. */
function height(place: SkyPlace, at: LatLon, days: number): number {
  const sidereal = RAD * (280.16 + 360.9856235 * days) + RAD * at.lon;
  const hourAngle = sidereal - place.ra;
  const latitude = RAD * at.lat;
  return (
    Math.asin(
      Math.sin(latitude) * Math.sin(place.dec) +
        Math.cos(latitude) * Math.cos(place.dec) * Math.cos(hourAngle),
    ) / RAD
  );
}

/** The sun's height above the horizon, in degrees, without the air's bending. */
export function sunHeight(at: LatLon, time: number): number {
  const days = daysSince2000(time);
  return height(sunPlace(days), at, days);
}

/** The moon's height above the horizon, in degrees, without the air's bending. */
function moonHeight(at: LatLon, time: number): number {
  const days = daysSince2000(time);
  return height(moonPlace(days), at, days);
}

/** How much of the moon is lit, from 0 to 1, and whether it is waxing. */
export function moonLight(time: number): { readonly lit: number; readonly waxing: boolean } {
  const days = daysSince2000(time);
  const sun = sunPlace(days);
  const moon = moonPlace(days);
  const elongation = Math.acos(
    Math.sin(sun.dec) * Math.sin(moon.dec) +
      Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  const phaseAngle = Math.atan2(
    SUN_DISTANCE_KM * Math.sin(elongation),
    moon.km - SUN_DISTANCE_KM * Math.cos(elongation),
  );
  const side = Math.atan2(
    Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra),
    Math.sin(sun.dec) * Math.cos(moon.dec) -
      Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  // The lit side faces the sun: west of the moon while it waxes.
  return { lit: (1 + Math.cos(phaseAngle)) / 2, waxing: side < 0 };
}

/** When something rises above a height, or sinks below it, within a stretch of time. */
export interface Crossings {
  /** The first time it rises above the height, if it does. */
  readonly up: number | null;
  /** The first time it sinks below it, if it does. */
  readonly down: number | null;
}

/** When `of` crosses `level` between `from` and `to`, to the minute. */
export function crossings(
  of: (time: number) => number,
  level: number,
  from: number,
  to: number,
): Crossings {
  let up: number | null = null;
  let down: number | null = null;
  const step = STEP_MIN * 60_000;
  let before = of(from) - level;
  for (let time = from + step; time <= to && (up === null || down === null); time += step) {
    const now = of(time) - level;
    if (before < 0 !== now < 0) {
      const crossing = time - step + (step * before) / (before - now);
      if (now >= 0) up ??= crossing;
      else down ??= crossing;
    }
    before = now;
  }
  return { up, down };
}

/** Whether the sun is up at `at` and `time`. */
export function sunIsUp(at: LatLon, time: number): boolean {
  return sunHeight(at, time) > SUN_RISE_SET;
}

/** Sunrise, sunset and the nautical twilights of the day from `from`, and the moon's rise and set. */
export interface LightOfDay {
  /** First light: the ground's shapes can be made out. */
  readonly dawn: number | null;
  readonly sunrise: number | null;
  readonly sunset: number | null;
  /** Last light: the ground's shapes can no longer be made out. */
  readonly dusk: number | null;
  readonly moonrise: number | null;
  readonly moonset: number | null;
}

/** The light of the 24 hours from `from`, usually the day's midnight, at `at`. */
export function lightOfDay(at: LatLon, from: number): LightOfDay {
  const to = from + DAY_MS;
  const sun = (time: number) => sunHeight(at, time);
  const rising = crossings(sun, SUN_RISE_SET, from, to);
  const twilight = crossings(sun, NAUTICAL, from, to);
  const moon = crossings((time) => moonHeight(at, time), MOON_RISE_SET, from, to);
  return {
    dawn: twilight.up,
    sunrise: rising.up,
    sunset: rising.down,
    dusk: twilight.down,
    moonrise: moon.up,
    moonset: moon.down,
  };
}

/** The next time the sun sets, and rises, after `time`, within a day. */
export function nextSunChanges(at: LatLon, time: number): Crossings {
  return crossings((t) => sunHeight(at, t), SUN_RISE_SET, time, time + DAY_MS);
}

/** The local midnight that starts the day of `time`. */
export function dayStart(time: number): number {
  return new Date(time).setHours(0, 0, 0, 0);
}
