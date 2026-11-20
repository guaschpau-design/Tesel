import { describe, expect, it } from 'vitest';

import { crossings, lightOfDay, moonLight, nextSunChanges, sunHeight, sunIsUp } from './sky.ts';

// SunCalc's own check: 5 March 2013, at 50.5° N 30.5° E (Kyiv).
const KYIV = { lat: 50.5, lon: 30.5 };
const MARCH_5 = Date.parse('2013-03-05T00:00:00Z');
const MINUTE = 60_000;

function near(time: number | null, expected: string, minutes: number): void {
  expect(time).not.toBeNull();
  expect(Math.abs((time ?? 0) - Date.parse(expected))).toBeLessThan(minutes * MINUTE);
}

describe('the light of a day', () => {
  it('finds sunrise, sunset and the nautical twilights to the minute', () => {
    const light = lightOfDay(KYIV, MARCH_5);
    near(light.sunrise, '2013-03-05T04:34:56Z', 1);
    near(light.sunset, '2013-03-05T15:46:57Z', 1);
    near(light.dawn, '2013-03-05T03:24:31Z', 1);
    near(light.dusk, '2013-03-05T16:57:22Z', 1);
  });

  it('finds when the moon rises and sets, to a few minutes', () => {
    const light = lightOfDay(KYIV, Date.parse('2013-03-04T00:00:00Z'));
    near(light.moonset, '2013-03-04T07:47:58Z', 6);
    near(light.moonrise, '2013-03-04T23:54:29Z', 6);
  });

  it('tells how much of the moon is lit, and that it wanes after the full moon', () => {
    const light = moonLight(MARCH_5);
    expect(light.lit).toBeCloseTo(0.4848, 2);
    expect(light.waxing).toBe(false);
    // 2013's spring full moon was on 27 March; a week before, it was waxing.
    expect(moonLight(Date.parse('2013-03-20T12:00:00Z')).waxing).toBe(true);
  });

  it('has the sun high at noon in summer, and down at midnight', () => {
    const valencia = { lat: 39.47, lon: -0.38 };
    // Midsummer noon by the sun: 90° − latitude + the earth's tilt, about 74°.
    expect(sunHeight(valencia, Date.parse('2026-06-21T12:02:00Z'))).toBeCloseTo(74, 0);
    expect(sunIsUp(valencia, Date.parse('2026-06-21T23:30:00Z'))).toBe(false);
  });

  it('gives no sunset in the polar summer', () => {
    const svalbard = { lat: 78.2, lon: 15.6 };
    const changes = nextSunChanges(svalbard, Date.parse('2026-06-21T00:00:00Z'));
    expect(changes).toEqual({ up: null, down: null });
  });

  it('interpolates a crossing between its steps', () => {
    const line = (time: number) => (time - 1000 * MINUTE) / MINUTE;
    const found = crossings(line, 0, 0, 2000 * MINUTE);
    expect(found.up).toBeCloseTo(1000 * MINUTE, -3);
    expect(found.down).toBeNull();
  });
});
