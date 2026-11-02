import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { activeSos, hasOwnSos } from './incidents.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const key = new Uint8Array(32);
const at = { lat: 39.47, lon: -0.37, accuracy: 10 };

const state = stateOf([
  {
    type: 'member-info',
    origin: ANA,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: key,
    alias: 'Ana',
  },
  {
    type: 'member-info',
    origin: BERTA,
    seq: 1,
    time: T0,
    role: 'member',
    publicKey: key,
    alias: 'Berta',
  },
  { type: 'sos', origin: BERTA, seq: 2, time: T0 + 10, kind: 'medical', ...at, text: 'Tobillo' },
  { type: 'sos', origin: BERTA, seq: 3, time: T0 + 20, kind: 'fire', ...at, text: '' },
  { type: 'ack', origin: ANA, seq: 2, time: T0 + 12, target: { origin: BERTA, seq: 2 } },
  { type: 'sos-cancel', origin: ANA, seq: 3, time: T0 + 30, sos: { origin: BERTA, seq: 3 } },
]);

describe('incidents', () => {
  it('lists active SOS calls with who acknowledged them', () => {
    const [call, ...others] = activeSos(state, ANA);
    expect(others).toEqual([]);
    expect(call).toMatchObject({ author: 'Berta', mine: false, by: ['Ana'], bySelf: true });
    expect(activeSos(state, BERTA)[0]).toMatchObject({ mine: true, bySelf: false });
  });

  it('tells whether this device has an SOS not cancelled yet', () => {
    expect(hasOwnSos(state, BERTA)).toBe(true);
    expect(hasOwnSos(state, ANA)).toBe(false);
  });
});
