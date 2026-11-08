import { offsetMeters, stateOf } from '@tesel/core';
import {
  ShapeStyleCode,
  type NodeId,
  type ShapeEvent,
  type ShapeGeometry,
  type SweepEvent,
  type TaskEvent,
  type ZoneCrossingEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  dueCrossings,
  sideOf,
  toldCrossings,
  watchedZones,
  ZoneWatch,
  type WatchedZone,
} from './zone-watch.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BEA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const CENTRE = { lat: 39.4699, lon: -0.3763 };

/** A square 200 m a side around the centre. */
const square = [
  offsetMeters(CENTRE, -100, -100),
  offsetMeters(CENTRE, 100, -100),
  offsetMeters(CENTRE, 100, 100),
  offsetMeters(CENTRE, -100, 100),
];

function shape(seq: number, style: number, geometry: ShapeGeometry): ShapeEvent {
  return {
    type: 'shape',
    origin: ANA,
    seq,
    time: T0 + seq,
    object: { origin: ANA, seq },
    style,
    label: `Zona ${String(seq)}`,
    geometry,
  };
}

function taskAt(seq: number, object: number, assignee: NodeId | null): TaskEvent {
  return {
    type: 'task',
    origin: ANA,
    seq,
    time: T0 + seq,
    task: { origin: ANA, seq },
    status: 'open',
    assignee,
    place: { kind: 'object', object: { origin: ANA, seq: object } },
    text: 'Buscar',
  };
}

const area = shape(1, ShapeStyleCode.SEARCH_ASSIGNED, { kind: 'polygon', points: square });
const zone: WatchedZone = { key: 'z', ref: area.object, shape: area, kind: 'assigned' };

/** A fix `north` metres from the centre, `seconds` after the start. */
function fixAt(north: number, seconds: number, accuracy: number | null = 5) {
  return { at: offsetMeters(CENTRE, north, 0), accuracy, time: seconds * 1000 };
}

describe('the areas watched', () => {
  it('are the danger areas and the areas of the tasks of the member or their team', () => {
    const sweep: SweepEvent = {
      type: 'sweep',
      origin: ANA,
      seq: 4,
      time: T0 + 4,
      object: { origin: ANA, seq: 4 },
      area: { origin: ANA, seq: 3 },
      spacing: 20,
      heading: 0,
      strip: 0,
      strips: 2,
    };
    const state = stateOf([
      shape(1, ShapeStyleCode.DANGER, { kind: 'circle', center: CENTRE, radius: 50 }),
      shape(2, ShapeStyleCode.SEARCH_ASSIGNED, { kind: 'polygon', points: square }),
      shape(3, ShapeStyleCode.SEARCH_ASSIGNED, { kind: 'polygon', points: square }),
      shape(5, ShapeStyleCode.SEARCH_ASSIGNED, { kind: 'polygon', points: square }),
      sweep,
      taskAt(10, 2, BEA),
      taskAt(11, 4, null),
      taskAt(12, 5, ANA),
      taskAt(13, 1, BEA),
    ]);
    const zones = watchedZones(state, BEA).map((watched) => [watched.shape.label, watched.kind]);
    expect(zones).toEqual([
      ['Zona 2', 'assigned'],
      ['Zona 1', 'danger'],
    ]);
  });
});

describe('the side of an area', () => {
  it('is none within the fix accuracy, or 10 m, of the edge', () => {
    const { geometry } = area;
    expect(sideOf(geometry, fixAt(0, 0))).toBe('inside');
    expect(sideOf(geometry, fixAt(95, 0))).toBeNull();
    expect(sideOf(geometry, fixAt(80, 0, 25))).toBeNull();
    expect(sideOf(geometry, fixAt(130, 0))).toBe('outside');
    const circle: ShapeGeometry = { kind: 'circle', center: CENTRE, radius: 50 };
    expect(sideOf(circle, fixAt(20, 0))).toBe('inside');
    expect(sideOf(circle, fixAt(55, 0))).toBeNull();
    expect(sideOf(circle, fixAt(70, 0))).toBe('outside');
  });
});

describe('a zone watch', () => {
  it('bears out a side with a second fix on it at least 10 s after the first', () => {
    const watch = new ZoneWatch();
    expect(watch.see([zone], fixAt(0, 0))).toEqual([]);
    expect(watch.see([zone], fixAt(0, 5))).toEqual([]);
    expect(watch.see([zone], fixAt(0, 12))).toEqual([{ zone, side: 'inside', before: null }]);
    expect(watch.see([zone], fixAt(150, 20))).toEqual([]);
    expect(watch.see([zone], fixAt(150, 31))).toEqual([
      { zone, side: 'outside', before: 'inside' },
    ]);
  });

  it('leaves out poor fixes, and a fix back on the old side starts over', () => {
    const watch = new ZoneWatch();
    watch.see([zone], fixAt(0, 0));
    watch.see([zone], fixAt(0, 12));
    expect(watch.see([zone], fixAt(150, 20, 60))).toEqual([]);
    expect(watch.see([zone], fixAt(150, 30))).toEqual([]);
    expect(watch.see([zone], fixAt(0, 35))).toEqual([]);
    expect(watch.see([zone], fixAt(150, 45))).toEqual([]);
    expect(watch.side('z')).toBe('inside');
  });

  it('forgets an area no longer watched', () => {
    const watch = new ZoneWatch();
    watch.see([zone], fixAt(0, 0));
    watch.see([zone], fixAt(0, 12));
    watch.see([], fixAt(0, 20));
    expect(watch.side('z')).toBeNull();
  });
});

describe('the crossings due', () => {
  const crossing = (seq: number, value: 'entered' | 'left'): ZoneCrossingEvent => ({
    type: 'zone-crossing',
    origin: BEA,
    seq,
    time: T0 + seq,
    zone: area.object,
    crossing: value,
    kind: 'assigned',
    ...CENTRE,
    accuracy: 5,
  });
  const key = 'a1b2c3d4:1';
  const watched = { ...zone, key };
  const inside = new Map([[key, 'inside' as const]]);
  const outside = new Map([[key, 'outside' as const]]);

  it('are what differs from what the group last heard, an area unheard of told once entered', () => {
    const none = new Map<string, never>();
    expect(dueCrossings([watched], outside, none, none, 0)).toEqual([]);
    expect(dueCrossings([watched], inside, none, none, 0)).toEqual([
      { zone: watched, crossing: 'entered' },
    ]);
    const told = toldCrossings([crossing(1, 'left'), crossing(2, 'entered')], BEA);
    expect(told.get(key)).toBe('entered');
    expect(dueCrossings([watched], inside, told, none, 0)).toEqual([]);
    expect(dueCrossings([watched], outside, told, none, 0)).toEqual([
      { zone: watched, crossing: 'left' },
    ]);
    expect(toldCrossings([crossing(1, 'left')], ANA).size).toBe(0);
  });

  it('wait a minute after the last told of the same area', () => {
    const sent = new Map([[key, 10_000]]);
    const none = new Map<string, never>();
    expect(dueCrossings([watched], inside, none, sent, 50_000)).toEqual([]);
    expect(dueCrossings([watched], inside, none, sent, 70_000)).toHaveLength(1);
  });
});
