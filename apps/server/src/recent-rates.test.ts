import { describe, expect, it } from 'vitest';

import { RecentRates } from './recent-rates.ts';

describe('recent rates', () => {
  it('measures how often a key does something lately, in times a second', () => {
    const rates = new RecentRates();
    for (let now = 0; now < 60_000; now += 200) rates.add('a', now);
    expect(rates.rate('a', 60_000)).toBeCloseTo(5, 0);
    expect(rates.rate('b', 60_000)).toBe(0);
    // Fading once it stops.
    expect(rates.rate('a', 70_000)).toBeLessThan(2);
  });

  it('counts the keys used lately, and forgets the others', () => {
    const rates = new RecentRates();
    rates.add('a', 0);
    rates.add('b', 0);
    expect(rates.keys(0)).toBe(2);
    rates.add('b', 30_000);
    expect(rates.keys(30_000)).toBe(1);
  });
});
