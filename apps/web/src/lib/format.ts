// Locale-aware formatting of sizes, dates and measures.

import type { Locale } from './i18n/index.ts';

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number, locale: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[unit] ?? ''}`;
}

export function formatDateTime(time: number, locale: string): string {
  return new Date(time).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

/** The time of day alone: for what comes within a day, such as the next sunset. */
export function formatClock(time: number, locale: string): string {
  return new Date(time).toLocaleTimeString(locale, { timeStyle: 'short' });
}

/** Time of day for today's moments, date and time for older ones. */
export function formatTime(time: number, locale: string, now: number = Date.now()): string {
  const date = new Date(time);
  return date.toDateString() === new Date(now).toDateString()
    ? date.toLocaleTimeString(locale, { timeStyle: 'short' })
    : formatDateTime(time, locale);
}

/** Metres up to a kilometre, then kilometres with one decimal below ten. */
export function formatDistance(metres: number, locale: string): string {
  if (metres < 1000) return `${Math.round(metres).toLocaleString(locale)} m`;
  const km = metres / 1000;
  return `${km.toLocaleString(locale, { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/** Square metres, then hectares, then square kilometres, as land is measured in each size. */
export function formatArea(squareMetres: number, locale: string): string {
  if (squareMetres < 10_000) return `${Math.round(squareMetres).toLocaleString(locale)} m²`;
  if (squareMetres < 1_000_000) {
    return `${(squareMetres / 10_000).toLocaleString(locale, { maximumFractionDigits: 1 })} ha`;
  }
  const km2 = squareMetres / 1_000_000;
  return `${km2.toLocaleString(locale, { maximumFractionDigits: km2 < 10 ? 2 : 1 })} km²`;
}

/** The eight compass points, from north clockwise; Spanish writes O for west. */
const COMPASS: Readonly<Record<Locale, readonly string[]>> = {
  es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

/**
 * How a bearing is written (ADR-0145): in degrees or in NATO mils, 6400 to the turn; from true
 * north, or from magnetic north for a compass, given the declination where it is taken (degrees
 * east of true north).
 */
export interface BearingStyle {
  readonly unit: 'degrees' | 'mils';
  readonly declination: number | null;
}

/** Degrees from true north: how bearings are written unless chosen otherwise. */
export const TRUE_DEGREES: BearingStyle = { unit: 'degrees', declination: null };

const MILS_PER_TURN = 6400;

/**
 * A bearing as three digits and its compass point, "047° NE", or as four digits of mils, "0836‰
 * NE"; an M after the unit when it is magnetic, "046°M NE".
 */
export function formatBearing(degrees: number, locale: Locale, style: BearingStyle): string {
  const bearing = (((degrees - (style.declination ?? 0)) % 360) + 360) % 360;
  const magnetic = style.declination === null ? '' : 'M';
  const point = COMPASS[locale][Math.round(bearing / 45) % 8] ?? '';
  if (style.unit === 'mils') {
    const mils = Math.round((bearing / 360) * MILS_PER_TURN) % MILS_PER_TURN;
    return `${String(mils).padStart(4, '0')}‰${magnetic} ${point}`;
  }
  const whole = Math.round(bearing) % 360;
  return `${String(whole).padStart(3, '0')}°${magnetic} ${point}`;
}

/** How long ago a moment was, in words: "hace 3 min", "2 h ago". Times in seconds. */
export function formatAgo(time: number, locale: Locale, now: number): string {
  const seconds = Math.max(0, Math.round(now - time));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (seconds < 60) return format.format(-seconds, 'second');
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86_400) return format.format(-Math.floor(seconds / 3600), 'hour');
  return format.format(-Math.floor(seconds / 86_400), 'day');
}
