import { describe, expect, it } from 'vitest';

import { headingOf } from './compass.svelte.ts';

describe('headingOf', () => {
  it("reads an iPhone's compass heading as it is", () => {
    expect(headingOf({ alpha: 10, absolute: false, webkitCompassHeading: 75 }, 0)).toBe(75);
  });

  it('reads an absolute alpha, which turns the other way, as degrees from north', () => {
    expect(headingOf({ alpha: 90, absolute: true }, 0)).toBe(270);
    expect(headingOf({ alpha: 0, absolute: true }, 0)).toBe(0);
  });

  it('gives nothing from a relative alpha, which is tied to no north', () => {
    expect(headingOf({ alpha: 90, absolute: false }, 0)).toBeNull();
    expect(headingOf({ alpha: null, absolute: true }, 0)).toBeNull();
  });

  it('turns with the screen held sideways', () => {
    expect(headingOf({ alpha: 0, absolute: true }, 90)).toBe(90);
    expect(headingOf({ alpha: 0, absolute: false, webkitCompassHeading: 350 }, 90)).toBe(80);
  });
});
