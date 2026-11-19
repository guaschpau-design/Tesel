// The magnetic declination at a place: how far a compass's north lies east (positive) or west
// (negative) of true north (ADR-0145). Worked out with the World Magnetic Model 2025, by NOAA and
// the British Geological Survey, in the public domain, valid from 2025 to 2030: its coefficients
// below, its spherical harmonic expansion to degree 12 at the ground (height 0 on the WGS84
// ellipsoid). Within a degree of the poles the declination means little, and it is not asked for.

import type { LatLon } from '@tesel/protocol';

/** The model's epoch, as a decimal year; the coefficients change linearly from it. */
const EPOCH = 2025;
const DEGREE = 12;

/**
 * Main field (g, h) and its yearly change (ġ, ḣ), in nT and nT a year, by degree n and order m,
 * as the model's coefficient file lists them: n, m, g, h, ġ, ḣ.
 */
const COEFFICIENTS: readonly (readonly [number, number, number, number, number, number])[] = [
  [1, 0, -29351.8, 0, 12.0, 0],
  [1, 1, -1410.8, 4545.4, 9.7, -21.5],
  [2, 0, -2556.6, 0, -11.6, 0],
  [2, 1, 2951.1, -3133.6, -5.2, -27.7],
  [2, 2, 1649.3, -815.1, -8.0, -12.1],
  [3, 0, 1361.0, 0, -1.3, 0],
  [3, 1, -2404.1, -56.6, -4.2, 4.0],
  [3, 2, 1243.8, 237.5, 0.4, -0.3],
  [3, 3, 453.6, -549.5, -15.6, -4.1],
  [4, 0, 895.0, 0, -1.6, 0],
  [4, 1, 799.5, 278.6, -2.4, -1.1],
  [4, 2, 55.7, -133.9, -6.0, 4.1],
  [4, 3, -281.1, 212.0, 5.6, 1.6],
  [4, 4, 12.1, -375.6, -7.0, -4.4],
  [5, 0, -233.2, 0, 0.6, 0],
  [5, 1, 368.9, 45.4, 1.4, -0.5],
  [5, 2, 187.2, 220.2, 0.0, 2.2],
  [5, 3, -138.7, -122.9, 0.6, 0.4],
  [5, 4, -142.0, 43.0, 2.2, 1.7],
  [5, 5, 20.9, 106.1, 0.9, 1.9],
  [6, 0, 64.4, 0, -0.2, 0],
  [6, 1, 63.8, -18.4, -0.4, 0.3],
  [6, 2, 76.9, 16.8, 0.9, -1.6],
  [6, 3, -115.7, 48.8, 1.2, -0.4],
  [6, 4, -40.9, -59.8, -0.9, 0.9],
  [6, 5, 14.9, 10.9, 0.3, 0.7],
  [6, 6, -60.7, 72.7, 0.9, 0.9],
  [7, 0, 79.5, 0, 0.0, 0],
  [7, 1, -77.0, -48.9, -0.1, 0.6],
  [7, 2, -8.8, -14.4, -0.1, 0.5],
  [7, 3, 59.3, -1.0, 0.5, -0.8],
  [7, 4, 15.8, 23.4, -0.1, 0.0],
  [7, 5, 2.5, -7.4, -0.8, -1.0],
  [7, 6, -11.1, -25.1, -0.8, 0.6],
  [7, 7, 14.2, -2.3, 0.8, -0.2],
  [8, 0, 23.2, 0, -0.1, 0],
  [8, 1, 10.8, 7.1, 0.2, -0.2],
  [8, 2, -17.5, -12.6, 0.0, 0.5],
  [8, 3, 2.0, 11.4, 0.5, -0.4],
  [8, 4, -21.7, -9.7, -0.1, 0.4],
  [8, 5, 16.9, 12.7, 0.3, -0.5],
  [8, 6, 15.0, 0.7, 0.2, -0.6],
  [8, 7, -16.8, -5.2, 0.0, 0.3],
  [8, 8, 0.9, 3.9, 0.2, 0.2],
  [9, 0, 4.6, 0, 0.0, 0],
  [9, 1, 7.8, -24.8, -0.1, -0.3],
  [9, 2, 3.0, 12.2, 0.1, 0.3],
  [9, 3, -0.2, 8.3, 0.3, -0.3],
  [9, 4, -2.5, -3.3, -0.3, 0.3],
  [9, 5, -13.1, -5.2, 0.0, 0.2],
  [9, 6, 2.4, 7.2, 0.3, -0.1],
  [9, 7, 8.6, -0.6, -0.1, -0.2],
  [9, 8, -8.7, 0.8, 0.1, 0.4],
  [9, 9, -12.9, 10.0, -0.1, 0.1],
  [10, 0, -1.3, 0, 0.1, 0],
  [10, 1, -6.4, 3.3, 0.0, 0.0],
  [10, 2, 0.2, 0.0, 0.1, 0.0],
  [10, 3, 2.0, 2.4, 0.1, -0.2],
  [10, 4, -1.0, 5.3, 0.0, 0.1],
  [10, 5, -0.6, -9.1, -0.3, -0.1],
  [10, 6, -0.9, 0.4, 0.0, 0.1],
  [10, 7, 1.5, -4.2, -0.1, 0.0],
  [10, 8, 0.9, -3.8, -0.1, -0.1],
  [10, 9, -2.7, 0.9, 0.0, 0.2],
  [10, 10, -3.9, -9.1, 0.0, 0.0],
  [11, 0, 2.9, 0, 0.0, 0],
  [11, 1, -1.5, 0.0, 0.0, 0.0],
  [11, 2, -2.5, 2.9, 0.0, 0.1],
  [11, 3, 2.4, -0.6, 0.0, 0.0],
  [11, 4, -0.6, 0.2, 0.0, 0.1],
  [11, 5, -0.1, 0.5, -0.1, 0.0],
  [11, 6, -0.6, -0.3, 0.0, 0.0],
  [11, 7, -0.1, -1.2, 0.0, 0.1],
  [11, 8, 1.1, -1.7, -0.1, 0.0],
  [11, 9, -1.0, -2.9, -0.1, 0.0],
  [11, 10, -0.2, -1.8, -0.1, 0.0],
  [11, 11, 2.6, -2.3, -0.1, 0.0],
  [12, 0, -2.0, 0, 0.0, 0],
  [12, 1, -0.2, -1.3, 0.0, 0.0],
  [12, 2, 0.3, 0.7, 0.0, 0.0],
  [12, 3, 1.2, 1.0, 0.0, -0.1],
  [12, 4, -1.3, -1.4, 0.0, 0.1],
  [12, 5, 0.6, 0.0, 0.0, 0.0],
  [12, 6, 0.6, 0.6, 0.1, 0.0],
  [12, 7, 0.5, -0.1, 0.0, 0.0],
  [12, 8, -0.1, 0.8, 0.0, 0.0],
  [12, 9, -0.4, 0.1, 0.0, 0.0],
  [12, 10, -0.2, -1.0, -0.1, 0.0],
  [12, 11, -1.3, 0.1, 0.0, 0.0],
  [12, 12, -0.7, 0.2, -0.1, -0.1],
];

/** WGS84's semi-axes, and the model's reference radius, in km. */
const A = 6378.137;
const B = 6356.752_314_2;
const REFERENCE_RADIUS = 6371.2;
const RADIANS = Math.PI / 180;

/** A moment as a decimal year: 2026.5 is the middle of 2026. */
export function decimalYear(time: Date): number {
  const year = time.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (time.getTime() - start) / (end - start);
}

/** Degrees east of true north a compass points at this place and time; west is negative. */
export function declination(at: LatLon, year: number): number {
  const dt = year - EPOCH;
  // Geodetic latitude to geocentric, on the ground.
  const lat = at.lat * RADIANS;
  const lon = at.lon * RADIANS;
  const e2 = 1 - (B * B) / (A * A);
  const n = A / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const p = n * Math.cos(lat);
  const z = n * (1 - e2) * Math.sin(lat);
  const r = Math.hypot(p, z);
  const latC = Math.asin(z / r);

  const legendre = schmidtLegendre(Math.sin(latC));
  // The field's north, east and down components, in the geocentric frame.
  let north = 0;
  let east = 0;
  let down = 0;
  for (const [deg, order, g, h, gDot, hDot] of COEFFICIENTS) {
    const gt = g + gDot * dt;
    const ht = h + hDot * dt;
    const ratio = (REFERENCE_RADIUS / r) ** (deg + 2);
    const cos = Math.cos(order * lon);
    const sin = Math.sin(order * lon);
    const { value, slope } = legendre(deg, order);
    north += ratio * (gt * cos + ht * sin) * slope;
    east += ratio * order * (gt * sin - ht * cos) * value;
    down -= ratio * (deg + 1) * (gt * cos + ht * sin) * value;
  }
  east /= Math.cos(latC);
  // To the geodetic frame: north and down turn by the difference of the two latitudes.
  const turn = latC - lat;
  const northGeodetic = north * Math.cos(turn) - down * Math.sin(turn);
  return Math.atan2(east, northGeodetic) / RADIANS;
}

/**
 * Schmidt semi-normalised associated Legendre functions of cos(colatitude), which is
 * sin(latitude), and their derivatives with respect to the colatitude, to the model's degree.
 */
function schmidtLegendre(
  sinLat: number,
): (n: number, m: number) => { value: number; slope: number } {
  const cosLat = Math.sqrt(1 - sinLat * sinLat);
  const size = DEGREE + 1;
  // Unnormalised (Gauss) values and derivatives, by recursion, then scaled.
  const p: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const dp: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const row = (n: number): number[] => p[n] ?? [];
  const drow = (n: number): number[] => dp[n] ?? [];
  row(0)[0] = 1;
  for (let n = 1; n <= DEGREE; n++) {
    for (let m = 0; m <= n; m++) {
      const pn = row(n);
      const dpn = drow(n);
      if (n === m) {
        const prev = row(n - 1)[m - 1] ?? 0;
        const dprev = drow(n - 1)[m - 1] ?? 0;
        pn[m] = cosLat * prev;
        dpn[m] = cosLat * dprev + sinLat * prev;
      } else {
        const prev = row(n - 1)[m] ?? 0;
        const dprev = drow(n - 1)[m] ?? 0;
        const prev2 = n >= 2 ? (row(n - 2)[m] ?? 0) : 0;
        const dprev2 = n >= 2 ? (drow(n - 2)[m] ?? 0) : 0;
        const k = n === 1 ? 0 : ((n - 1) ** 2 - m * m) / ((2 * n - 1) * (2 * n - 3));
        pn[m] = sinLat * prev - k * prev2;
        dpn[m] = sinLat * dprev - cosLat * prev - k * dprev2;
      }
    }
  }
  // Schmidt factors: S(n, 0) = (2n − 1)!! / n!, S(n, m) = S(n, m − 1) √((n − m + 1)(δ + 1)/(n + m)).
  const scale: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const srow = (n: number): number[] => scale[n] ?? [];
  srow(0)[0] = 1;
  for (let n = 1; n <= DEGREE; n++) {
    const sn = srow(n);
    sn[0] = (srow(n - 1)[0] ?? 0) * ((2 * n - 1) / n);
    for (let m = 1; m <= n; m++) {
      const delta = m === 1 ? 2 : 1;
      sn[m] = (sn[m - 1] ?? 0) * Math.sqrt(((n - m + 1) * delta) / (n + m));
    }
  }
  return (n, m) => {
    const s = srow(n)[m] ?? 0;
    return { value: s * (row(n)[m] ?? 0), slope: s * (drow(n)[m] ?? 0) };
  };
}
