import { distanceMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import { metresPerPixel } from '../map/geometry.ts';
import { LEAST_PX, movementFeatures, SECONDS_AHEAD } from './app6-movement.ts';

const AT = { lat: 39.47, lon: -0.37 };

/** How long, in metres, the line drawn for a movement is. */
function length(speed: number | null, zoom: number): number {
  const [line] = movementFeatures([{ at: AT, heading: 90, speed }], zoom).features;
  if (line?.geometry.type !== 'LineString') throw new Error('no line');
  const [, [lon = 0, lat = 0] = []] = line.geometry.coordinates;
  return distanceMeters(AT, { lat, lon });
}

describe('the movement indicator', () => {
  it('ends where it will be in a minute', () => {
    expect(length(15, 16)).toBeCloseTo(15 * SECONDS_AHEAD, 0);
  });

  it('reaches past the symbol however slow, and only points without a speed', () => {
    const least = LEAST_PX * metresPerPixel(14, AT.lat);
    expect(length(1.2, 14)).toBeCloseTo(least, 0);
    expect(length(null, 14)).toBeCloseTo(least, 0);
  });

  it('puts an arrowhead at the tip, turned the way it moves', () => {
    const [, head] = movementFeatures([{ at: AT, heading: 90, speed: 15 }], 16).features;
    expect(head?.geometry.type).toBe('Point');
    expect(head?.properties.heading).toBe(90);
  });
});
