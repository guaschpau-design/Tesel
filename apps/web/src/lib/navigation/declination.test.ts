import { describe, expect, it } from 'vitest';

import { decimalYear, declination } from './declination.ts';

describe('declination', () => {
  // Declinations known for late 2026, to within half a degree.
  it.each([
    ['Madrid', 40.42, -3.7, 0.7],
    ['Barcelona', 41.39, 2.17, 2.1],
    ['Gran Canaria', 28.1, -15.4, -3.2],
    ['Boulder', 40.0, -105.25, 7.6],
    ['Sydney', -33.87, 151.2, 12.8],
    ['Tokyo', 35.68, 139.69, -7.9],
  ] as const)('is about right in %s', (_place, lat, lon, expected) => {
    expect(declination({ lat, lon }, 2026.9)).toBeCloseTo(expected, 0);
  });

  it('drifts slowly with the years', () => {
    const now = declination({ lat: 40.42, lon: -3.7 }, 2026);
    const later = declination({ lat: 40.42, lon: -3.7 }, 2029);
    expect(Math.abs(later - now)).toBeLessThan(1);
  });
});

describe('decimalYear', () => {
  it('counts the year as it goes', () => {
    expect(decimalYear(new Date(Date.UTC(2026, 0, 1)))).toBe(2026);
    expect(decimalYear(new Date(Date.UTC(2026, 6, 2, 12)))).toBeCloseTo(2026.5, 2);
  });
});
