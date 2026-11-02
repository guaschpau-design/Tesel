import { stateOf } from '@tesel/core';
import { ShapeStyleCode, type NodeId, type ShapeEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { operationAreas } from './operation-areas.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;

function area(seq: number, style: number): ShapeEvent {
  return {
    type: 'shape',
    origin: ANA,
    seq,
    time: T0 + seq,
    object: { origin: ANA, seq },
    style,
    label: `Zona ${String(seq)}`,
    geometry: {
      kind: 'polygon',
      points: [
        { lat: 39.44, lon: -0.42 },
        { lat: 39.5, lon: -0.42 },
        { lat: 39.47, lon: -0.33 },
      ],
    },
  };
}

describe('operation areas', () => {
  it('finds the areas drawn as operation areas, with their bounds', () => {
    const state = stateOf([area(1, ShapeStyleCode.OPERATION_AREA), area(2, ShapeStyleCode.DANGER)]);
    expect(operationAreas(state)).toEqual([
      {
        key: `${ANA}:1`,
        label: 'Zona 1',
        bounds: { west: -0.42, south: 39.44, east: -0.33, north: 39.5 },
      },
    ]);
  });

  it('forgets an operation area once it is deleted', () => {
    const deleted = {
      type: 'object-delete',
      origin: ANA,
      seq: 3,
      time: T0 + 3,
      object: { origin: ANA, seq: 1 },
    } as const;
    expect(operationAreas(stateOf([area(1, ShapeStyleCode.OPERATION_AREA), deleted]))).toEqual([]);
  });

  it('keeps the bounds of a circle near a pole within the world’s edges', () => {
    const circle: ShapeEvent = {
      ...area(1, ShapeStyleCode.OPERATION_AREA),
      geometry: { kind: 'circle', center: { lat: 85, lon: 170 }, radius: 1_000_000 },
    };
    const [found] = operationAreas(stateOf([circle]));
    expect(found?.bounds).toMatchObject({ north: 90, east: 180 });
    expect(found?.bounds.west).toBeCloseTo(67, 0);
    expect(found?.bounds.south).toBeCloseTo(76, 0);
  });
});
