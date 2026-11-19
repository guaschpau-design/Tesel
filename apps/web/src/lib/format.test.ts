import { describe, expect, it } from 'vitest';

import { formatAgo, formatArea, formatBearing, formatDistance, TRUE_DEGREES } from './format.ts';

describe('formatting measures', () => {
  it('writes distances in metres, then kilometres', () => {
    expect(formatDistance(847.4, 'es')).toBe('847 m');
    expect(formatDistance(1250, 'es')).toBe('1,3 km');
    expect(formatDistance(12_400, 'en')).toBe('12 km');
  });

  it('writes areas in square metres, hectares or square kilometres', () => {
    expect(formatArea(950, 'es')).toBe('950 m²');
    expect(formatArea(25_300, 'es')).toBe('2,5 ha');
    expect(formatArea(3_456_000, 'en')).toBe('3.46 km²');
  });

  it('writes bearings with three digits and the compass point in each language', () => {
    expect(formatBearing(47.2, 'es', TRUE_DEGREES)).toBe('047° NE');
    expect(formatBearing(247, 'es', TRUE_DEGREES)).toBe('247° SO');
    expect(formatBearing(247, 'en', TRUE_DEGREES)).toBe('247° SW');
    expect(formatBearing(359.6, 'en', TRUE_DEGREES)).toBe('000° N');
  });

  it('writes bearings in mils, 6400 to the turn', () => {
    const mils = { unit: 'mils', declination: null } as const;
    expect(formatBearing(47, 'es', mils)).toBe('0836‰ NE');
    expect(formatBearing(180, 'en', mils)).toBe('3200‰ S');
    expect(formatBearing(359.99, 'en', mils)).toBe('0000‰ N');
  });

  it('writes magnetic bearings for a compass, with an M', () => {
    // Where a compass points 2° east of true north, a true 47° reads 45° on it.
    expect(formatBearing(47, 'es', { unit: 'degrees', declination: 2 })).toBe('045°M NE');
    // West of true north, it reads more; and round the turn.
    expect(formatBearing(359, 'en', { unit: 'degrees', declination: -3 })).toBe('002°M N');
    expect(formatBearing(1, 'en', { unit: 'mils', declination: 2 })).toBe('6382‰M N');
  });

  it('says how long ago something was, in the largest whole unit', () => {
    const now = 1_761_350_400;
    expect(formatAgo(now - 20, 'es', now)).toBe('hace 20 s');
    expect(formatAgo(now - 185, 'es', now)).toBe('hace 3 min');
    expect(formatAgo(now - 7300, 'en', now)).toBe('2 hr. ago');
  });
});
