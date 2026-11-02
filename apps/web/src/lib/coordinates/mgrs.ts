// The Military Grid Reference System: UTM coordinates written with letters for the 100 km square,
// as ATAK, NATO forces and many rescue teams use them. "30S YJ 25695 72210" is a 1 m square;
// fewer digits mean a larger square.

import { bandSouth, fromUtm, type Utm } from './utm.ts';

/** Column letters of the 100 km squares; the set repeats every three zones. */
const COLUMN_SETS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'] as const;
/** Row letters, repeating every 2 000 km of northing; even zones start five letters later. */
const ROWS = 'ABCDEFGHJKLMNPQRSTUV';
const SQUARE = 100_000;
const ROW_CYCLE = 2_000_000;

/**
 * Lowest northing in each band, rounded down (as in NGA's GEOTRANS), to tell which 2 000 km cycle
 * a row letter is in.
 */
const BAND_MIN_NORTHING: Readonly<Record<string, number>> = {
  C: 1_100_000,
  D: 2_000_000,
  E: 2_800_000,
  F: 3_700_000,
  G: 4_600_000,
  H: 5_500_000,
  J: 6_400_000,
  K: 7_300_000,
  L: 8_200_000,
  M: 9_100_000,
  N: 0,
  P: 800_000,
  Q: 1_700_000,
  R: 2_600_000,
  S: 3_500_000,
  T: 4_400_000,
  U: 5_300_000,
  V: 6_200_000,
  W: 7_000_000,
  X: 7_900_000,
};

export interface Mgrs {
  readonly zone: number;
  readonly band: string;
  /** The 100 km square: column and row letters. */
  readonly square: string;
  /** Metres east and north within the square, cut down (never rounded) to `digits`. */
  readonly easting: number;
  readonly northing: number;
  /** Digits for each of easting and northing: 5 is a metre, 1 is ten kilometres. */
  readonly digits: number;
}

export function toMgrs(utm: Utm, digits = 5): Mgrs {
  const columnSet = COLUMN_SETS[(utm.zone - 1) % 3] ?? '';
  const column = columnSet[Math.floor(utm.easting / SQUARE) - 1] ?? '';
  const rowOffset = utm.zone % 2 === 0 ? 5 : 0;
  const row = ROWS[(Math.floor(utm.northing / SQUARE) + rowOffset) % ROWS.length] ?? '';
  const unit = 10 ** (5 - digits);
  return {
    zone: utm.zone,
    band: utm.band,
    square: column + row,
    easting: Math.floor((utm.easting % SQUARE) / unit),
    northing: Math.floor((utm.northing % SQUARE) / unit),
    digits,
  };
}

/**
 * The UTM coordinates of the centre of an MGRS square, or null if no such square exists. MGRS
 * names a square by its south-west corner; its centre is the better guess of the point meant.
 */
export function mgrsToUtm(mgrs: Mgrs): Utm | null {
  const [columnLetter = '', rowLetter = ''] = mgrs.square;
  const column = (COLUMN_SETS[(mgrs.zone - 1) % 3] ?? '').indexOf(columnLetter);
  const rowIndex = ROWS.indexOf(rowLetter);
  const minNorthing = BAND_MIN_NORTHING[mgrs.band];
  if (column < 0 || rowIndex < 0 || minNorthing === undefined) return null;
  const unit = 10 ** (5 - mgrs.digits);
  const rowOffset = mgrs.zone % 2 === 0 ? 5 : 0;
  let northing = ((rowIndex - rowOffset + ROWS.length) % ROWS.length) * SQUARE;
  while (northing < minNorthing) northing += ROW_CYCLE;
  const utm = {
    zone: mgrs.zone,
    band: mgrs.band,
    easting: (column + 1) * SQUARE + (mgrs.easting + 0.5) * unit,
    northing: northing + (mgrs.northing + 0.5) * unit,
  };
  // A row letter names a square in every 2 000 km: only the one within the band exists.
  return isInBand(utm) ? utm : null;
}

/**
 * How far beyond its band, in latitude, a point may be read: a 100 km square straddles the band's
 * edge, and a wrong row letter lands some 18° away.
 */
const BAND_MARGIN_DEGREES = 1;

function isInBand(utm: Utm): boolean {
  const south = bandSouth(utm.band);
  const north = south + (utm.band === 'X' ? 12 : 8);
  const { lat } = fromUtm(utm);
  return lat >= south - BAND_MARGIN_DEGREES && lat <= north + BAND_MARGIN_DEGREES;
}

/** As people write it: zone and band, square, easting, northing, with spaces between. */
export function formatMgrs(mgrs: Mgrs): string {
  const pad = (value: number) => String(value).padStart(mgrs.digits, '0');
  return `${String(mgrs.zone)}${mgrs.band} ${mgrs.square} ${pad(mgrs.easting)} ${pad(mgrs.northing)}`;
}

/** Reads "30SYJ2569572210", "30S YJ 25695 72210" or fewer digits; null if it is not MGRS. */
export function parseMgrs(text: string): Mgrs | null {
  const match = /^(\d{1,2})\s*([C-HJ-NP-X])\s*([A-HJ-NP-Z][A-HJ-NP-V])\s*(\d*)\s*(\d*)$/.exec(
    text.trim().toUpperCase(),
  );
  if (match === null) return null;
  const [, zoneText = '', band = '', square = '', first = '', second = ''] = match;
  const zone = Number(zoneText);
  // The digits may come as one run or as two halves of equal length.
  const allDigits = first + second;
  if (zone < 1 || zone > 60 || allDigits.length % 2 !== 0 || allDigits.length > 10) return null;
  if (second !== '' && first.length !== second.length) return null;
  const digits = allDigits.length / 2;
  return {
    zone,
    band,
    square,
    easting: Number(allDigits.slice(0, digits) || '0'),
    northing: Number(allDigits.slice(digits) || '0'),
    digits,
  };
}
