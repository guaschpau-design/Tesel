import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { memberFeatures } from './member-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const CARLA = '630dcd29' as NodeId;
const T0 = 1_761_350_400;
const fix = { lat: 39.47, lon: -0.37, accuracy: 5, heading: null, speed: null };

describe('member features', () => {
  it('draws the other members who share their position, labelled with their alias', () => {
    const state = stateOf([
      {
        type: 'member-info',
        origin: BERTA,
        seq: 1,
        time: T0,
        role: 'member',
        publicKey: new Uint8Array(32),
        alias: 'Berta',
      },
      { type: 'position', origin: ANA, seq: 2, time: T0, ...fix },
      { type: 'position', origin: BERTA, seq: 2, time: T0 - 3600, ...fix },
      { type: 'position', origin: CARLA, seq: 2, time: T0, ...fix },
      { type: 'position-hidden', origin: CARLA, seq: 3, time: T0 + 1 },
    ]);
    const { features } = memberFeatures(state, ANA, T0 + 10, null);
    expect(features.map((f) => f.properties)).toEqual([
      { id: BERTA, label: 'Berta', stale: true, sos: false, away: false, tone: 'none', icon: '' },
    ]);
    expect(features[0]?.geometry.coordinates).toEqual([-0.37, 39.47]);
  });

  it('gives each member their APP-6 symbol on the tactical map: their profile, their role', () => {
    const told = { status: 'active', battery: null, equipment: [] } as const;
    const state = stateOf([
      { type: 'position', origin: BERTA, seq: 1, time: T0, ...fix },
      { type: 'member-state', origin: BERTA, seq: 2, time: T0, ...told, profile: 'firefighters' },
      { type: 'position', origin: CARLA, seq: 1, time: T0, ...fix },
    ]);
    const military = { locale: 'es' } as const;
    const icons = memberFeatures(state, ANA, T0, military).features.map((f) => f.properties.icon);
    expect(icons).toEqual(['tesel-app6-member-firefighters', 'tesel-app6-member-unspecified']);
  });

  it('marks the members resting or off duty', () => {
    const told = { profile: 'rescue', battery: null, equipment: [] } as const;
    const state = stateOf([
      { type: 'position', origin: BERTA, seq: 1, time: T0, ...fix },
      { type: 'position', origin: CARLA, seq: 1, time: T0, ...fix },
      { type: 'member-state', origin: BERTA, seq: 2, time: T0, ...told, status: 'resting' },
      { type: 'member-state', origin: CARLA, seq: 2, time: T0, ...told, status: 'active' },
    ]);
    const away = memberFeatures(state, ANA, T0, null).features.filter((f) => f.properties.away);
    expect(away.map((f) => f.properties.id)).toEqual([BERTA]);
  });

  it('marks the members whose SOS is still open', () => {
    const sos = { kind: 'general', lat: 0, lon: 0, accuracy: null, text: '' } as const;
    const state = stateOf([
      { type: 'position', origin: BERTA, seq: 1, time: T0, ...fix },
      { type: 'position', origin: CARLA, seq: 1, time: T0, ...fix },
      { type: 'sos', origin: BERTA, seq: 2, time: T0, ...sos },
      { type: 'sos', origin: CARLA, seq: 2, time: T0, ...sos },
      { type: 'sos-cancel', origin: CARLA, seq: 3, time: T0 + 1, sos: { origin: CARLA, seq: 2 } },
    ]);
    const calling = memberFeatures(state, ANA, T0, null).features.filter((f) => f.properties.sos);
    expect(calling.map((f) => f.properties.id)).toEqual([BERTA]);
  });
});
