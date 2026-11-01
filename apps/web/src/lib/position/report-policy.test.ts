import { describe, expect, it } from 'vitest';

import { distanceMeters } from '@tesel/core';
import { nextReport } from './report-policy.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const NEARBY = { lat: 39.47, lon: -0.3763 }; // about 11 m north
const FURTHER = { lat: 39.4704, lon: -0.3763 }; // about 55 m north

describe('position reports', () => {
  it('measures distances on the Earth', () => {
    expect(distanceMeters(VALENCIA, { lat: 40.4168, lon: -3.7038 })).toBeCloseTo(302_000, -4);
    expect(distanceMeters(VALENCIA, NEARBY)).toBeCloseTo(11, 0);
  });

  it('reports the first fix at once', () => {
    expect(nextReport(null, { at: VALENCIA, accuracy: 40 }, 1000)).toBe('fix');
  });

  it('reports a move of 10 m with a sharp GPS, but not more than every 5 s', () => {
    const last = { at: VALENCIA, accuracy: 4, time: 1000 };
    expect(nextReport(last, { at: NEARBY, accuracy: 4 }, 1004)).toBeNull();
    expect(nextReport(last, { at: NEARBY, accuracy: 4 }, 1005)).toBe('fix');
  });

  it('takes a jump within the two fixes’ uncertainty for the GPS wandering, not a move', () => {
    const last = { at: VALENCIA, accuracy: 25, time: 1000 };
    expect(nextReport(last, { at: NEARBY, accuracy: 25 }, 1010)).toBeNull();
    expect(nextReport(last, { at: FURTHER, accuracy: 25 }, 1010)).toBe('fix');
  });

  it('reports a much sharper fix of the same place: the GPS has settled', () => {
    const last = { at: VALENCIA, accuracy: 40, time: 1000 };
    expect(nextReport(last, { at: NEARBY, accuracy: 30 }, 1010)).toBeNull();
    expect(nextReport(last, { at: NEARBY, accuracy: 20 }, 1010)).toBe('fix');
  });

  it('while standing still, publishes the same place again every minute', () => {
    const last = { at: VALENCIA, accuracy: 25, time: 1000 };
    expect(nextReport(last, { at: NEARBY, accuracy: 25 }, 1059)).toBeNull();
    expect(nextReport(last, { at: NEARBY, accuracy: 25 }, 1060)).toBe('again');
  });
});
