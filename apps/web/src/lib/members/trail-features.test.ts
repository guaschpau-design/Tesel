import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { trailFeatures } from './trail-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const fix = { lon: -0.37, accuracy: 5, heading: null, speed: null };

describe('trail features', () => {
  it('draws no line for a member whose GPS only wandered around one place', () => {
    const vague = { ...fix, accuracy: 25 };
    const state = stateOf([
      { type: 'position', origin: ANA, seq: 1, time: T0, lat: 39.47, ...vague },
      { type: 'position', origin: ANA, seq: 2, time: T0 + 10, lat: 39.4702, ...vague },
      { type: 'position', origin: ANA, seq: 3, time: T0 + 20, lat: 39.4698, ...vague },
    ]);
    expect(trailFeatures(state, ANA).features).toEqual([]);
  });

  it('draws a line for each member who has moved, marking this device’s own', () => {
    const state = stateOf([
      { type: 'position', origin: ANA, seq: 1, time: T0, lat: 39.47, ...fix },
      { type: 'position', origin: ANA, seq: 2, time: T0 + 60, lat: 39.48, ...fix },
      // Still there a minute later: the move is borne out.
      { type: 'position', origin: ANA, seq: 3, time: T0 + 120, lat: 39.48, ...fix },
      { type: 'position', origin: BERTA, seq: 1, time: T0, lat: 39.4, ...fix },
    ]);
    const { features } = trailFeatures(state, ANA);
    expect(features).toHaveLength(1);
    expect(features[0]?.properties).toEqual({ self: true });
    expect(features[0]?.geometry.coordinates).toEqual([
      [-0.37, 39.47],
      [-0.37, 39.48],
    ]);
  });
});
