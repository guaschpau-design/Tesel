import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { markerFeatures, shapeFeatures } from './object-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const at = { lat: 39.47, lon: -0.37 };

describe('map object features', () => {
  const state = stateOf([
    {
      type: 'marker',
      origin: ANA,
      seq: 2,
      time: T0,
      object: { origin: ANA, seq: 2 },
      symbol: 3,
      ...at,
      label: 'Fuego',
    },
    {
      type: 'marker',
      origin: ANA,
      seq: 3,
      time: T0,
      object: { origin: ANA, seq: 3 },
      symbol: 0x0999,
      ...at,
      label: 'Raro',
    },
    {
      type: 'shape',
      origin: ANA,
      seq: 4,
      time: T0,
      object: { origin: ANA, seq: 4 },
      style: 1,
      label: 'Peligro',
      geometry: {
        kind: 'polygon',
        points: [at, { lat: 39.48, lon: -0.37 }, { lat: 39.48, lon: -0.36 }],
      },
    },
    {
      type: 'shape',
      origin: ANA,
      seq: 5,
      time: T0,
      object: { origin: ANA, seq: 5 },
      style: 99,
      label: '',
      geometry: { kind: 'circle', center: at, radius: 100 },
    },
    {
      type: 'marker',
      origin: ANA,
      seq: 6,
      time: T0,
      object: { origin: ANA, seq: 6 },
      symbol: 1,
      ...at,
      label: 'Borrado',
    },
    { type: 'object-delete', origin: ANA, seq: 7, time: T0 + 1, object: { origin: ANA, seq: 6 } },
  ]);

  it('draws markers with their symbol, unknown symbols as the generic one, and no deleted ones', () => {
    expect(
      markerFeatures(state).features.map((f) => [f.properties.label, f.properties.icon]),
    ).toEqual([
      ['Fuego', 'tesel-symbol-3'],
      ['Raro', 'tesel-symbol-0'],
    ]);
  });

  it('closes polygons and draws circles as rings, unknown styles as neutral', () => {
    const [polygon, circle] = shapeFeatures(state).features;
    expect(polygon?.geometry.type).toBe('Polygon');
    const ring = polygon?.geometry.type === 'Polygon' ? polygon.geometry.coordinates[0] : [];
    expect(ring?.at(0)).toEqual(ring?.at(-1));
    expect(polygon?.properties.tone).toBe('red');
    expect(circle?.properties.tone).toBe('slate');
  });

  it('draws the largest circle near a pole with no point past it', () => {
    const polar = stateOf([
      {
        type: 'shape',
        origin: ANA,
        seq: 1,
        time: T0,
        object: { origin: ANA, seq: 1 },
        style: 1,
        label: '',
        geometry: { kind: 'circle', center: { lat: 85, lon: 0 }, radius: 1_000_000 },
      },
    ]);
    const [circle] = shapeFeatures(polar).features;
    const ring = circle?.geometry.type === 'Polygon' ? circle.geometry.coordinates[0] : [];
    const lats = (ring ?? []).map(([, lat]) => lat ?? Number.NaN);
    expect(lats.length).toBeGreaterThan(0);
    expect(Math.max(...lats)).toBe(90);
    expect(lats.every((lat) => lat >= -90 && lat <= 90)).toBe(true);
  });
});
