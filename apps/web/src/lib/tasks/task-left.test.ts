import { offsetMeters, stateOf } from '@tesel/core';
import {
  eventRefKey,
  type LatLon,
  type NodeId,
  type Place,
  type PositionEvent,
  type TaskEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { handedAt, positionsSince, wayLeft } from './task-left.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BEA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const CENTRE = { lat: 39.4699, lon: -0.3763 };
/** A point `north` and `east` metres from the centre. */
const at = (north: number, east = 0): LatLon => offsetMeters(CENTRE, north, east);

/** Positions of Bea at these points, a minute apart. */
function walked(...points: LatLon[]): PositionEvent[] {
  return points.map((point, index) => ({
    type: 'position',
    origin: BEA,
    seq: index + 1,
    time: T0 + 60 * index,
    ...point,
    accuracy: 5,
    heading: null,
    speed: null,
  }));
}

describe('what a member has left', () => {
  it('to a point is the straight way there, and nothing once there', () => {
    const left = wayLeft({ kind: 'point', at: at(500) }, walked(at(0), at(100)));
    expect(left?.metres).toBeCloseTo(400, -1);
    expect(left?.straight).toBe(true);
    expect(left?.way).toHaveLength(2);
    expect(wayLeft({ kind: 'point', at: at(500) }, walked(at(492)))?.metres).toBe(0);
  });

  it('to an area is the straight way to its edge, and nothing inside it', () => {
    const circle = { kind: 'circle', center: at(500), radius: 100 } as const;
    expect(wayLeft({ kind: 'area', geometry: circle }, walked(at(0)))?.metres).toBeCloseTo(400, -1);
    expect(wayLeft({ kind: 'area', geometry: circle }, walked(at(450)))?.metres).toBe(0);
    const square = {
      kind: 'polygon',
      points: [at(300, -100), at(300, 100), at(500, 100), at(500, -100)],
    } as const;
    expect(wayLeft({ kind: 'area', geometry: square }, walked(at(0)))?.metres).toBeCloseTo(300, -1);
  });

  it('along a way is its start and all of it before starting, then the rest of it', () => {
    const route = { kind: 'way', points: [at(0), at(0, 400), at(400, 400)] } as const;
    const before = wayLeft(route, walked(at(-200)));
    expect(before?.metres).toBeCloseTo(1000, -1);
    expect(before?.straight).toBe(false);
    expect(wayLeft(route, walked(at(0, 10), at(0, 200)))?.metres).toBeCloseTo(600, -1);
    expect(wayLeft(route, walked(at(0, 100), at(0, 400), at(395, 400)))?.metres).toBe(0);
  });

  it('out and back the same way, is the way back once the turn is behind', () => {
    const route = { kind: 'way', points: [at(0), at(0, 500), at(0)] } as const;
    expect(wayLeft(route, walked(at(0, 200)))?.metres).toBeCloseTo(800, -1);
    const back = wayLeft(route, walked(at(0, 100), at(0, 300), at(0, 498), at(0, 200)));
    expect(back?.metres).toBeCloseTo(200, -1);
  });

  it('is not known without a position', () => {
    expect(wayLeft({ kind: 'point', at: CENTRE }, [])).toBeNull();
  });
});

describe('the positions that count for a task', () => {
  const trail = walked(at(0), at(100), at(200), at(300));

  it('are those since it was handed out, and where the member was then', () => {
    expect(positionsSince(trail, T0 + 90).map((position) => position.seq)).toEqual([2, 3, 4]);
    expect(positionsSince(trail, T0).map((position) => position.seq)).toEqual([1, 2, 3, 4]);
    expect(positionsSince(trail, T0 + 999).map((position) => position.seq)).toEqual([4]);
    expect(positionsSince([], T0)).toEqual([]);
  });
});

describe('since when a task has been for whom it is, where it is', () => {
  const task = (seq: number, assignee: NodeId, place: Place, status = 'open' as const) =>
    ({
      type: 'task',
      origin: ANA,
      seq,
      time: T0 + seq,
      task: { origin: ANA, seq: 1 },
      status,
      assignee,
      place,
      text: 'Buscar',
    }) satisfies TaskEvent;
  const here: Place = { kind: 'point', at: CENTRE };
  const key = eventRefKey({ origin: ANA, seq: 1 });

  it('is when it was last handed out or moved, not when it was started', () => {
    const journal = stateOf([
      task(1, ANA, here),
      task(2, BEA, here),
      { ...task(3, BEA, here), status: 'in-progress' },
    ]).journal;
    expect(handedAt(journal, key)).toBe(T0 + 2);
    const moved = stateOf([task(1, BEA, here), task(4, BEA, { kind: 'point', at: at(50) })]);
    expect(handedAt(moved.journal, key)).toBe(T0 + 4);
    expect(handedAt(journal, eventRefKey({ origin: ANA, seq: 9 }))).toBeNull();
  });
});
