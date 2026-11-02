// Latitude and longitude written in degrees: decimal ("39.46990, -0.37630", as phones and 112
// apps share them) or degrees, minutes and seconds ("39°28′11.6″ N 0°22′34.7″ W", as paper maps
// and aviation write them).

import type { LatLon } from '@tesel/protocol';

/** Five decimals of a degree are about a metre. */
const DECIMALS = 5;

export function formatDecimal({ lat, lon }: LatLon): string {
  return `${lat.toFixed(DECIMALS)}, ${lon.toFixed(DECIMALS)}`;
}

export function formatDms({ lat, lon }: LatLon): string {
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
}

/** Degrees, minutes and tenths of a second (about 3 m), with the hemisphere's letter. */
function dms(value: number, positive: string, negative: string): string {
  const tenths = Math.round(Math.abs(value) * 36_000);
  const degrees = Math.floor(tenths / 36_000);
  const minutes = Math.floor((tenths % 36_000) / 600);
  const seconds = (tenths % 600) / 10;
  const hemisphere = value < 0 ? negative : positive;
  return `${String(degrees)}°${pad(minutes)}′${seconds < 10 ? '0' : ''}${seconds.toFixed(1)}″ ${hemisphere}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** A number, or one of the hemisphere letters (O is Spanish for west). */
type Token =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'hemisphere'; readonly letter: string };

/**
 * Reads latitude and longitude in degrees: decimal, degrees and minutes, or degrees, minutes and
 * seconds; signed or with hemisphere letters before or after; with or without the symbols ° ′ ″.
 * A decimal comma is understood when the text has no decimal point. Null if it is not that.
 */
export function parseDegrees(text: string): LatLon | null {
  const tokens = tokenise(text);
  if (tokens === null) return null;
  const groups = splitInTwo(tokens);
  if (groups === null) return null;
  const [first, second] = groups.map(angleOf);
  if (first === null || second === null || first === undefined || second === undefined) {
    return null;
  }
  // Longitude first only when the letters say so: "0°22′W 39°28′N".
  const [lat, lon] =
    first.axis === 'lon' || second.axis === 'lat' ? [second, first] : [first, second];
  if (lat.axis === 'lon' || lon.axis === 'lat') return null;
  if (Math.abs(lat.value) > 90 || Math.abs(lon.value) > 180) return null;
  return { lat: lat.value, lon: lon.value };
}

function tokenise(text: string): Token[] | null {
  const decimalComma = !text.includes('.');
  const normalised = text.toUpperCase().replace(/(\d),(\d)/g, decimalComma ? '$1.$2' : '$1 $2');
  const tokens: Token[] = [];
  for (const [part] of normalised.matchAll(/[-+]?\d+(?:\.\d+)?|[NSEWO]|[^\s,;°º'"′″]/g)) {
    if (/^[NSEWO]$/.test(part))
      tokens.push({ kind: 'hemisphere', letter: part === 'O' ? 'W' : part });
    else if (/\d/.test(part)) tokens.push({ kind: 'number', value: Number(part) });
    else return null;
  }
  return tokens;
}

/** Splits the tokens into latitude and longitude, each a run of one to three numbers. */
function splitInTwo(tokens: readonly Token[]): [Token[], Token[]] | null {
  const letters = tokens.filter((token) => token.kind === 'hemisphere').length;
  if (letters === 0) {
    if (tokens.length % 2 !== 0) return null;
    return [tokens.slice(0, tokens.length / 2), tokens.slice(tokens.length / 2)];
  }
  if (letters !== 2) return null;
  // Letters after the numbers close each half; letters before them open it.
  const lettersFirst = tokens[0]?.kind === 'hemisphere';
  const cut = tokens.findIndex(
    (token, index) => token.kind === 'hemisphere' && (lettersFirst ? index > 0 : true),
  );
  const at = lettersFirst ? cut : cut + 1;
  return [tokens.slice(0, at), tokens.slice(at)];
}

/** One angle from its numbers and letter: which axis the letter says, and its signed value. */
function angleOf(tokens: readonly Token[]): { axis: 'lat' | 'lon' | null; value: number } | null {
  const numbers = tokens.flatMap((token) => (token.kind === 'number' ? [token.value] : []));
  const letter = tokens.find((token) => token.kind === 'hemisphere');
  const [degrees, minutes = 0, seconds = 0] = numbers;
  if (
    degrees === undefined ||
    numbers.length > 3 ||
    numbers.length + (letter ? 1 : 0) !== tokens.length
  ) {
    return null;
  }
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
  // Only the last number may have decimals, and only degrees may carry a sign.
  if (numbers.slice(0, -1).some((value) => !Number.isInteger(value))) return null;
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  // "-0 30" is half a degree south or west: the sign of zero counts.
  const signed = degrees < 0 || Object.is(degrees, -0);
  if (letter !== undefined && signed) return null;
  const negative = signed || letter?.letter === 'S' || letter?.letter === 'W';
  const axis =
    letter === undefined ? null : letter.letter === 'N' || letter.letter === 'S' ? 'lat' : 'lon';
  return { axis, value: negative ? -magnitude : magnitude };
}
