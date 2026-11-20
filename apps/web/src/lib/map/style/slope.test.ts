import { describe, expect, it } from 'vitest';

import { gradePercent, HARD_PERCENT, metresPerPixel, NO_GO_PERCENT, slopePixels } from './slope.ts';

/** Heights rising eastwards by `grade` percent, `metres` apart. */
const ramp = (grade: number, metres: number) => (x: number) => (x * metres * grade) / 100;

describe('slopes', () => {
  it('reads the grade of the ground from its neighbours', () => {
    expect(gradePercent(ramp(45, 10), 3, 3, 10)).toBeCloseTo(45);
  });

  it('leaves clear what a vehicle crosses, amber what is hard going, red what none climbs', () => {
    const alpha = (grade: number) => slopePixels(ramp(grade, 10), 4, 10)[3];
    expect(alpha(HARD_PERCENT - 5)).toBe(0);
    const hard = slopePixels(ramp(HARD_PERCENT + 5, 10), 4, 10);
    const noGo = slopePixels(ramp(NO_GO_PERCENT + 5, 10), 4, 10);
    expect([...hard.slice(0, 3)]).toEqual([235, 150, 20]);
    expect([...noGo.slice(0, 3)]).toEqual([200, 30, 30]);
  });

  it('knows how far apart a tile’s pixels are on the ground', () => {
    // A 512-pixel tile at zoom 13 across Madrid's latitude: some 7 m.
    const y = Math.floor(
      ((1 - Math.log(Math.tan(0.7046) + 1 / Math.cos(0.7046)) / Math.PI) / 2) * 2 ** 13,
    );
    expect(metresPerPixel(13, y, 512)).toBeGreaterThan(6.5);
    expect(metresPerPixel(13, y, 512)).toBeLessThan(7.5);
  });
});
