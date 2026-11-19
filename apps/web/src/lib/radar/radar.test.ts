import { distanceMeters, stateOf } from '@tesel/core';
import type { NodeId, PositionEvent } from '@tesel/protocol';
import type { LineString } from 'geojson';
import { describe, expect, it } from 'vitest';

import { TRUE_DEGREES } from '../format.ts';
import { nearestMembers, ringFeatures, ringStep, RING_COUNT, vectorFeatures } from './radar.ts';

const SELF = 'aaaa0001' as NodeId;
const NOW = 1_793_000_000;
const HERE = { lat: 39.4699, lon: -0.3763 };

/** A member's position report, `metresNorth` of here, `secondsAgo` old. */
function position(origin: string, metresNorth: number, secondsAgo = 0): PositionEvent {
  return {
    type: 'position',
    origin: origin as NodeId,
    seq: 1,
    time: NOW - secondsAgo,
    lat: HERE.lat + metresNorth / 111_195,
    lon: HERE.lon,
    accuracy: 5,
    heading: null,
    speed: null,
  };
}

describe('radar', () => {
  it('spaces its rings to the zoom, by round distances', () => {
    expect(ringStep(16, HERE.lat)).toBe(100);
    expect(ringStep(14, HERE.lat)).toBe(250);
    expect(ringStep(11, HERE.lat)).toBe(2_500);
  });

  it('draws its rings at multiples of the step, labelled at their northern edge', () => {
    const rings = ringFeatures(HERE, 250, 'es').features;
    const lines = rings.filter((f) => f.geometry.type === 'LineString');
    expect(lines).toHaveLength(RING_COUNT);
    expect(rings.map((f) => String(f.properties?.['label']))).toContain('1 km');
    const [lon = 0, lat = 0] = (lines[0]?.geometry as LineString).coordinates[0] ?? [];
    expect(distanceMeters(HERE, { lat, lon })).toBeCloseTo(250, 0);
    expect(lon).toBeCloseTo(HERE.lon, 6);
  });

  it('finds the nearest members with a recent position, leaving this device out', () => {
    const state = stateOf([
      position('bbbb0001', 900),
      position('bbbb0002', 200),
      position('bbbb0003', 50, 20 * 60),
      position(SELF, 10),
      ...['c1', 'c2', 'c3', 'c4'].map((id, k) => position(`cccc000${id}`, 1_000 + k * 100)),
    ]);
    const nearby = nearestMembers(state, SELF, HERE, NOW);
    expect(nearby.map((member) => member.id)).toEqual([
      'bbbb0002',
      'bbbb0001',
      'cccc000c1',
      'cccc000c2',
      'cccc000c3',
    ]);
    expect(nearby[0]?.distance).toBeCloseTo(200, -1);
    expect(nearby[0]?.bearing).toBeCloseTo(0, 0);
  });

  it('labels each line with distance and bearing', () => {
    const state = stateOf([position('bbbb0002', 200)]);
    const lines = vectorFeatures(HERE, nearestMembers(state, SELF, HERE, NOW), 'es', TRUE_DEGREES);
    expect(lines.features[0]?.properties?.['label']).toBe('200 m · 000° N');
  });
});
