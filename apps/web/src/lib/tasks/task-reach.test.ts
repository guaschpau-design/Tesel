import { offsetMeters, stateOf } from '@tesel/core';
import {
  eventRefKey,
  ShapeStyleCode,
  type LatLon,
  type NodeId,
  type Place,
  type ShapeEvent,
  type ShapeGeometry,
  type TaskEvent,
  type TaskReachedEvent,
  type TeamEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { goalsToReach, reachOf, ReachWatch, taskGoal, type TaskGoal } from './task-reach.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BEA = '0f1e2d3c' as NodeId;
const CARLA = 'c0c0c0c0' as NodeId;
const TEAM = 'e0e0e0e0' as NodeId;
const T0 = 1_761_350_400;
const CENTRE = { lat: 39.4699, lon: -0.3763 };
/** A point `north` and `east` metres from the centre. */
const at = (north: number, east = 0): LatLon => offsetMeters(CENTRE, north, east);

function shape(seq: number, geometry: ShapeGeometry): ShapeEvent {
  return {
    type: 'shape',
    origin: ANA,
    seq,
    time: T0 + seq,
    object: { origin: ANA, seq },
    style: ShapeStyleCode.ROUTE,
    label: '',
    geometry,
  };
}

function task(seq: number, place: Place | null, assignee: NodeId | null = BEA): TaskEvent {
  return {
    type: 'task',
    origin: ANA,
    seq,
    time: T0 + seq,
    task: { origin: ANA, seq },
    status: 'open',
    assignee,
    place,
    text: 'Buscar',
  };
}

function reached(by: NodeId, seq: number, of: number): TaskReachedEvent {
  return {
    type: 'task-reached',
    origin: by,
    seq,
    time: T0 + 100 + seq,
    task: { origin: ANA, seq: of },
    ...CENTRE,
    accuracy: 5,
  };
}

const team: TeamEvent = {
  type: 'team',
  origin: ANA,
  seq: 50,
  time: T0 + 50,
  team: TEAM,
  name: 'Norte',
  colour: 'blue',
  members: [BEA, CARLA],
  dissolved: false,
};

const objectAt = (seq: number): Place => ({ kind: 'object', object: { origin: ANA, seq } });

/** A fix at a point, `seconds` after the start. */
function fixAt(point: LatLon, seconds: number, accuracy: number | null = 5) {
  return { at: point, accuracy, time: seconds * 1000 };
}

describe('where a task is reached', () => {
  const line = shape(1, { kind: 'polyline', points: [at(0), at(300)] });
  const circle = shape(2, { kind: 'circle', center: CENTRE, radius: 50 });
  const objects = stateOf([line, circle]).objects;

  it('is its point, its area, or the end of its way', () => {
    expect(taskGoal({ kind: 'point', at: CENTRE }, objects)).toEqual({
      kind: 'point',
      at: CENTRE,
    });
    expect(taskGoal(objectAt(2), objects)).toEqual({ kind: 'area', geometry: circle.geometry });
    expect(taskGoal(objectAt(1), objects)).toEqual({ kind: 'way', points: [at(0), at(300)] });
  });

  it('is nowhere for a task without a place, or whose object is gone', () => {
    expect(taskGoal(null, objects)).toBeNull();
    expect(taskGoal(objectAt(9), objects)).toBeNull();
  });
});

describe('who reached a task', () => {
  it('is the member, or the first of their team to get there', () => {
    const state = stateOf([team, reached(ANA, 1, 7), reached(CARLA, 2, 7), reached(BEA, 3, 7)]);
    const key = eventRefKey({ origin: ANA, seq: 7 });
    expect(reachOf(state, key, BEA)?.origin).toBe(CARLA);
    expect(reachOf(state, key, ANA)?.origin).toBe(ANA);
    expect(reachOf(state, eventRefKey({ origin: ANA, seq: 8 }), BEA)).toBeNull();
  });

  it('leaves out what is reached already, by them or their team, and what has no place', () => {
    const state = stateOf([
      team,
      task(1, { kind: 'point', at: CENTRE }),
      task(2, { kind: 'point', at: at(100) }, TEAM),
      task(3, null),
      task(4, { kind: 'point', at: at(200) }, CARLA),
      reached(CARLA, 1, 2),
    ]);
    expect([...goalsToReach(state, BEA).keys()]).toEqual([eventRefKey({ origin: ANA, seq: 1 })]);
  });
});

describe('reaching the place of a task', () => {
  const point = new Map<string, TaskGoal>([['p', { kind: 'point', at: CENTRE }]]);

  it('counts once a second fix there bears out the first, ten seconds later', () => {
    const watch = new ReachWatch();
    expect(watch.see(point, fixAt(at(8), 0))).toBe(false);
    expect(watch.see(point, fixAt(at(5), 6))).toBe(false);
    expect(watch.see(point, fixAt(at(4), 11))).toBe(true);
    expect([...watch.reached()]).toEqual(['p']);
    // Gone again: no longer there.
    expect(watch.see(point, fixAt(at(80), 30))).toBe(true);
    expect(watch.reached().size).toBe(0);
  });

  it('leaves out poor fixes, and starts again after a fix away', () => {
    const watch = new ReachWatch();
    watch.see(point, fixAt(at(0), 0));
    expect(watch.see(point, fixAt(at(0), 20, 45))).toBe(false);
    watch.see(point, fixAt(at(60), 25));
    expect(watch.see(point, fixAt(at(0), 30))).toBe(false);
    expect(watch.see(point, fixAt(at(0), 40))).toBe(true);
  });

  it('counts inside an area, clear of its edge', () => {
    const area = new Map<string, TaskGoal>([
      ['a', { kind: 'area', geometry: { kind: 'circle', center: CENTRE, radius: 100 } }],
    ]);
    const watch = new ReachWatch();
    watch.see(area, fixAt(at(95), 0));
    expect(watch.see(area, fixAt(at(95), 20))).toBe(false);
    watch.see(area, fixAt(at(40), 30));
    // By the edge: no telling, neither in nor out.
    expect(watch.see(area, fixAt(at(97), 35))).toBe(false);
    expect(watch.see(area, fixAt(at(30), 40))).toBe(true);
    expect(watch.see(area, fixAt(at(97), 50))).toBe(false);
    expect([...watch.reached()]).toEqual(['a']);
  });

  it('counts at the end of a way once walked, a loop not at its start', () => {
    const loop = new Map<string, TaskGoal>([
      ['w', { kind: 'way', points: [at(0), at(0, 300), at(300, 300), at(0)] }],
    ]);
    const watch = new ReachWatch();
    watch.see(loop, fixAt(at(2), 0));
    expect(watch.see(loop, fixAt(at(2), 20))).toBe(false);
    for (const [index, point] of [at(0, 150), at(0, 300), at(300, 300), at(150, 150)].entries()) {
      watch.see(loop, fixAt(point, 60 * (index + 1)));
    }
    watch.see(loop, fixAt(at(3), 400));
    expect(watch.see(loop, fixAt(at(2), 420))).toBe(true);
  });

  it('forgets a task no longer to reach', () => {
    const watch = new ReachWatch();
    watch.see(point, fixAt(at(0), 0));
    watch.see(point, fixAt(at(0), 20));
    expect(watch.see(new Map(), fixAt(at(0), 30))).toBe(true);
    expect(watch.reached().size).toBe(0);
  });
});
