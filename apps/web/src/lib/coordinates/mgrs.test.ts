import { describe, expect, it } from 'vitest';

import { formatMgrs, mgrsToUtm, parseMgrs, toMgrs } from './mgrs.ts';
import { toUtm } from './utm.ts';

// Reference values from NGA's GEOTRANS, through the Python "mgrs" package.
const REFERENCES = [
  { name: 'Valencia', lat: 39.4699, lon: -0.3763, mgrs: '30S YJ 25695 72210' },
  { name: 'Bilbao', lat: 43.263, lon: -2.935, mgrs: '30T WN 05275 90023' },
  { name: 'Las Palmas', lat: 28.1235, lon: -15.4363, mgrs: '28R DS 57150 10960' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, mgrs: '56H LH 34368 50948' },
  { name: 'Reykjavik', lat: 64.1466, lon: -21.9426, mgrs: '27W VM 54138 13689' },
  { name: 'the equator', lat: 0.0001, lon: -0.0001, mgrs: '30N ZF 33967 00011' },
] as const;

describe('MGRS', () => {
  for (const point of REFERENCES) {
    it(`names the same square as GEOTRANS in ${point.name}`, () => {
      const utm = toUtm(point);
      expect(utm && formatMgrs(toMgrs(utm))).toBe(point.mgrs);
    });

    it(`reads the square back to within a metre in ${point.name}`, () => {
      const parsed = parseMgrs(point.mgrs);
      const utm = parsed && mgrsToUtm(parsed);
      const expected = toUtm(point);
      expect(Math.abs((utm?.easting ?? 0) - (expected?.easting ?? 0))).toBeLessThan(1);
      expect(Math.abs((utm?.northing ?? 0) - (expected?.northing ?? 0))).toBeLessThan(1);
    });
  }

  it('reads it with or without spaces and with fewer digits', () => {
    expect(parseMgrs('30syj2569572210')).toEqual(parseMgrs('30S YJ 25695 72210'));
    expect(parseMgrs('30S YJ 256 722')).toMatchObject({ easting: 256, northing: 722, digits: 3 });
  });

  it('takes the centre of a larger square as the point meant', () => {
    const parsed = parseMgrs('30S YJ 256 722');
    expect(parsed && mgrsToUtm(parsed)).toMatchObject({ easting: 725650, northing: 4372250 });
  });

  it('refuses what is not MGRS', () => {
    expect(parseMgrs('30S YJ 2569 72210')).toBeNull();
    expect(parseMgrs('61S YJ 25695 72210')).toBeNull();
    expect(parseMgrs('30S IJ 25695 72210')).toBeNull();
    expect(parseMgrs('39.4699, -0.3763')).toBeNull();
  });

  it('finds no square whose row letter lies outside the band', () => {
    const rows = 'ABCDEFGHJKLMNPQRSTUV'.match(/./g) ?? [];
    const read = rows.map((row) => {
      const parsed = parseMgrs(`30S Y${row} 50000 50000`);
      return parsed && mgrsToUtm(parsed);
    });
    const found = read.filter((utm) => utm !== null);
    // Band S is 8° high, some 900 km: nine or ten of the twenty rows.
    expect(found.length).toBeGreaterThan(8);
    expect(found.length).toBeLessThan(12);
  });
});
