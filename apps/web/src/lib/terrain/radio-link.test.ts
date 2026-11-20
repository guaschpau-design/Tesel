import { describe, expect, it } from 'vitest';

import { linkOver, radioLink } from './radio-link.ts';

/** Flat ground at 100 m, `count` points, with `hill` m more at the middle one. */
function ground(count: number, hill: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    index === Math.floor(count / 2) ? 100 + hill : 100,
  );
}

describe('a radio link over the ground', () => {
  it('is clear across a valley', () => {
    const valley = Array.from({ length: 21 }, (_, index) =>
      index === 0 || index === 20 ? 100 : 40,
    );
    expect(linkOver(valley, 2000, 1.5)?.verdict).toEqual({ kind: 'clear' });
  });

  it('is cut by a hill above the line, told where and how high', () => {
    const verdict = linkOver(ground(21, 40), 2000, 1.5)?.verdict;
    expect(verdict).toEqual({ kind: 'blocked', metres: 1000, height: 140, from: 1000 });
  });

  it('grazes when the ground is under the line but within the Fresnel zone', () => {
    // At 2 km on 868 MHz, the first zone is about 13 m across at the middle.
    expect(linkOver(ground(21, 0), 2000, 1.5)?.verdict.kind).toBe('grazing');
    // Masts 10 m high clear it.
    expect(linkOver(ground(21, 0), 2000, 10)?.verdict.kind).toBe('clear');
  });

  it('feels the curve of the earth over long flat ground', () => {
    // 20 km of sea-flat ground: the bulge, about 6 m, rises above antennas held in the hand.
    expect(linkOver(ground(41, 0), 20_000, 1.5)?.verdict.kind).toBe('blocked');
  });

  it('is unknown where an elevation is', async () => {
    const link = await radioLink(
      { elevations: (points) => Promise.resolve(points.map(() => null)) },
      { lat: 39.47, lon: -0.38 },
      { lat: 39.48, lon: -0.37 },
      1.5,
    );
    expect(link).toBeNull();
  });
});
