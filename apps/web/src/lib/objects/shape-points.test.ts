import { encodeEvent, type LatLon, type NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { densify } from './shape-points.ts';

function encodes(points: readonly LatLon[]): boolean {
  return encodeEvent({
    type: 'shape',
    origin: 'a1b2c3d4' as NodeId,
    seq: 1,
    time: 1_750_000_000,
    object: { origin: 'a1b2c3d4' as NodeId, seq: 1 },
    style: 0,
    label: '',
    geometry: { kind: 'polyline', points },
  }).ok;
}

describe('points of a shape as they can be sent', () => {
  it('leaves short segments as they are', () => {
    const points = [
      { lat: 39.47, lon: -0.37 },
      { lat: 39.48, lon: -0.36 },
    ];
    expect(densify(points)).toEqual(points);
  });

  it('adds points along a segment too long to send, which then can be', () => {
    const points = [
      { lat: 39.47, lon: -0.37 },
      { lat: 40.42, lon: -3.7 },
    ];
    expect(encodes(points)).toBe(false);
    const dense = densify(points);
    expect(dense.length).toBeGreaterThan(2);
    expect(dense.at(0)).toEqual(points[0]);
    expect(dense.at(-1)).toEqual(points[1]);
    expect(encodes(dense)).toBe(true);
  });

  it('goes the short way across the antimeridian', () => {
    const dense = densify([
      { lat: 0, lon: 179.9 },
      { lat: 0, lon: -179.9 },
    ]);
    expect(dense).toHaveLength(2);
  });
});
