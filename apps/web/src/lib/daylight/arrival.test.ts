import { describe, expect, it } from 'vitest';

import { arrivalLight, nextLight } from './arrival.ts';
import { lightOfDay } from './sky.ts';

const VALENCIA = { lat: 39.47, lon: -0.38 };
const DAY = Date.parse('2026-11-20T00:00:00Z');
const MINUTE = 60_000;
const { sunrise, sunset } = lightOfDay(VALENCIA, DAY);
if (sunrise === null || sunset === null) throw new Error('Valencia has a sunrise and a sunset');

describe('the light on arriving', () => {
  it('is daylight well before sunset', () => {
    expect(arrivalLight(VALENCIA, sunrise + 60 * MINUTE, sunset - 120 * MINUTE)).toEqual({
      kind: 'day',
    });
  });

  it('is little light within half an hour of sunset', () => {
    const light = arrivalLight(VALENCIA, sunset - 120 * MINUTE, sunset - 13 * MINUTE);
    expect(light.kind).toBe('dim');
    expect(light.kind === 'dim' && light.minutes).toBe(13);
  });

  it('is night after sunset, telling when the sun set', () => {
    const light = arrivalLight(VALENCIA, sunset - 30 * MINUTE, sunset + 30 * MINUTE);
    expect(light.kind).toBe('night');
    expect(light.kind === 'night' && Math.abs((light.sunset ?? 0) - sunset)).toBeLessThan(MINUTE);
  });

  it('is night before sunrise, telling when the sun rises', () => {
    const light = arrivalLight(VALENCIA, sunrise - 180 * MINUTE, sunrise - 60 * MINUTE);
    expect(light.kind === 'night' && light.sunset).toBeNull();
    expect(light.kind === 'night' && Math.abs((light.sunrise ?? 0) - sunrise)).toBeLessThan(MINUTE);
  });
});

describe('the next change of the light', () => {
  it('by day, the sunset and last light after it', () => {
    const next = nextLight(VALENCIA, sunrise + 60 * MINUTE);
    expect(next.kind).toBe('sets');
    if (next.kind !== 'sets') return;
    expect(Math.abs(next.sunset - sunset)).toBeLessThan(MINUTE);
    // Nautical twilight ends about an hour after sunset in Valencia in November.
    expect(((next.dusk ?? 0) - next.sunset) / MINUTE).toBeGreaterThan(50);
  });

  it('by night, the sunrise', () => {
    expect(nextLight(VALENCIA, sunset + 60 * MINUTE).kind).toBe('rises');
  });
});
