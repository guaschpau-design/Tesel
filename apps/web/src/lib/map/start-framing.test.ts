import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { FakeMap } from './fake-map.ts';
import { groupPoints, StartFraming } from './start-framing.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const CARLA = '630dcd29' as NodeId;
const T0 = 1_761_350_400;
const VALENCIA = { lat: 39.47, lon: -0.37 };
const NEAR = { lat: 39.48, lon: -0.36 };

describe('framing the group at start', () => {
  it('frames everyone each time someone new appears, not each time someone moves', () => {
    const map = new FakeMap();
    const framing = new StartFraming(map.map, true);
    framing.show(new Map([['self', VALENCIA]]));
    framing.show(new Map([['self', NEAR]]));
    framing.show(
      new Map([
        ['self', NEAR],
        [BERTA, VALENCIA],
      ]),
    );
    expect(map.fitted).toEqual([
      [
        [-0.37, 39.47],
        [-0.37, 39.47],
      ],
      [
        [-0.37, 39.47],
        [-0.36, 39.48],
      ],
    ]);
  });

  it('stops for good once the user moves the map, but not when the map is resized', () => {
    const map = new FakeMap();
    const framing = new StartFraming(map.map, true);
    framing.show(new Map([['self', VALENCIA]]));
    map.moveTo({});
    framing.show(new Map([[BERTA, NEAR]]));
    map.moveTo({ zoom: 12 });
    framing.show(new Map([[CARLA, NEAR]]));
    expect(map.fitted).toHaveLength(2);
  });

  it('never starts on a view the address gave', () => {
    const map = new FakeMap();
    new StartFraming(map.map, false).show(new Map([['self', VALENCIA]]));
    expect(map.fitted).toEqual([]);
  });

  it('brings into view this device and the members whose positions are fresh', () => {
    const fix = { accuracy: 5, heading: null, speed: null };
    const positions = stateOf([
      { type: 'position', origin: ANA, seq: 1, time: T0, ...VALENCIA, ...fix },
      { type: 'position', origin: BERTA, seq: 1, time: T0, ...NEAR, ...fix },
      { type: 'position', origin: CARLA, seq: 1, time: T0 - 3600, ...NEAR, ...fix },
    ]).positions;
    expect(groupPoints(positions, ANA, VALENCIA, T0 + 60, [])).toEqual(
      new Map([
        ['self', VALENCIA],
        [BERTA, NEAR],
      ]),
    );
  });

  it('brings into view the operation areas, by their corners', () => {
    const area = { west: -0.4, south: 39.4, east: -0.3, north: 39.5 };
    expect(groupPoints(new Map(), ANA, null, T0, [area])).toEqual(
      new Map([
        ['area-0-sw', { lat: 39.4, lon: -0.4 }],
        ['area-0-ne', { lat: 39.5, lon: -0.3 }],
      ]),
    );
  });
});
