import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { sosFeatures } from './sos-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const at = { lat: 39.47, lon: -0.37 };
const call = { kind: 'general', accuracy: null, text: '' } as const;

describe('SOS features', () => {
  const state = stateOf([
    {
      type: 'member-info',
      origin: ANA,
      seq: 1,
      time: T0,
      role: 'member',
      publicKey: new Uint8Array(32),
      alias: 'Ana',
    },
    { type: 'sos', origin: ANA, seq: 2, time: T0, ...at, ...call },
    { type: 'sos', origin: ANA, seq: 3, time: T0, ...at, ...call, kind: 'fire' },
    { type: 'sos-cancel', origin: ANA, seq: 4, time: T0 + 1, sos: { origin: ANA, seq: 3 } },
    // Called without a place: drawn where Berta shared her position since.
    { type: 'sos', origin: BERTA, seq: 1, time: T0, lat: 0, lon: 0, ...call },
    {
      type: 'position',
      origin: BERTA,
      seq: 2,
      time: T0 + 5,
      lat: 39.5,
      lon: -0.4,
      accuracy: 5,
      heading: null,
      speed: null,
    },
  ]);

  it('draws only the calls still open, each where its caller is', () => {
    const drawn = sosFeatures(state).features.map(({ properties, geometry }) => [
      // A call's key starts with its reference, and tells it apart from a rival (core rivals.ts).
      properties.key.split('/')[0],
      properties.label,
      geometry.coordinates,
    ]);
    expect(drawn).toEqual([
      [`${ANA}:2`, 'Ana', [-0.37, 39.47]],
      [`${BERTA}:1`, BERTA, [-0.4, 39.5]],
    ]);
  });
});
