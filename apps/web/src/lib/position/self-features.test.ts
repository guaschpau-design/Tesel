import { offsetMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import type { DeviceFix } from './device-location.svelte.ts';
import { drawnAlike, selfFeatures } from './self-features.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };

function fix(north: number, accuracy: number | null): DeviceFix {
  return { at: offsetMeters(VALENCIA, north, 0), accuracy, heading: null, speed: null, time: 0 };
}

describe('the dot of this device', () => {
  it('is not drawn again for a fix within a pixel, nor a circle within a pixel', () => {
    expect(drawnAlike(fix(0, 5), fix(1, 5.5), 2)).toBe(true);
    expect(drawnAlike(fix(0, 5), fix(3, 5), 2)).toBe(false);
    expect(drawnAlike(fix(0, 5), fix(0, 8), 2)).toBe(false);
    expect(drawnAlike(fix(0, 5), fix(0, null), 2)).toBe(false);
  });

  it('is drawn when it appears or goes', () => {
    expect(drawnAlike(null, null, 2)).toBe(true);
    expect(drawnAlike(null, fix(0, 5), 2)).toBe(false);
    expect(drawnAlike(fix(0, 5), null, 2)).toBe(false);
  });
});

describe('this device on the tactical map', () => {
  it('carries the way it points, only when there is one', () => {
    const dot = (heading: number | null) => selfFeatures(fix(0, null), 'Tú', heading).features[0];
    expect(dot(45)?.properties).toEqual({ label: 'Tú', heading: 45 });
    expect(dot(null)?.properties).toEqual({ label: 'Tú' });
  });
});
