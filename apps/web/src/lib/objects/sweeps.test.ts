import { offsetMeters, reduce, stateOf, type GroupState } from '@tesel/core';
import { ShapeStyleCode, type NodeId, type TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { restyledShape } from '../sync/member-events.ts';
import { objectName } from './object-names.ts';
import {
  areasToClear,
  ClearingMarks,
  isStripDone,
  stripOf,
  stripPath,
  stripsOver,
  stripWalker,
  sweptBy,
} from './sweeps.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const CORNER = { lat: 42.5, lon: 1.5 };
const at = (north: number, east: number) => offsetMeters(CORNER, north, east);
const t = translator('es');

/** A search area 100 m wide and 400 m long, swept in two strips of two lanes 25 m apart. */
const AREA: TeselEvent = {
  type: 'shape',
  origin: ANA,
  seq: 1,
  time: T0,
  object: { origin: ANA, seq: 1 },
  style: ShapeStyleCode.SEARCH_ASSIGNED,
  label: 'Ladera',
  geometry: { kind: 'polygon', points: [CORNER, at(0, 100), at(400, 100), at(400, 0)] },
};

function strip(seq: number, index: number): TeselEvent {
  return {
    type: 'sweep',
    origin: ANA,
    seq,
    time: T0 + seq,
    object: { origin: ANA, seq },
    area: { origin: ANA, seq: 1 },
    spacing: 25,
    heading: 0,
    strip: index,
    strips: 2,
  };
}

function task(seq: number, stripSeq: number, status: 'open' | 'done', origin = ANA): TeselEvent {
  return {
    type: 'task',
    origin,
    seq,
    time: T0 + seq,
    task: { origin: ANA, seq: stripSeq + 10 },
    status,
    assignee: BERTA,
    place: { kind: 'object', object: { origin: ANA, seq: stripSeq } },
    text: 'Batida',
  };
}

const PLANNED = [AREA, strip(2, 0), strip(3, 1), task(12, 2, 'open'), task(13, 3, 'open')];

describe('sweeps', () => {
  it('finds the strips over an area, in order, with their lanes and names', () => {
    const state = stateOf(PLANNED);
    expect(stripsOver(state.objects, `${ANA}:1`).map((item) => item.key)).toEqual([
      `${ANA}:2`,
      `${ANA}:3`,
    ]);
    const record = state.objects.get(`${ANA}:3`);
    if (record?.type !== 'sweep') throw new Error('no strip');
    const second = stripOf(record, state.objects);
    expect(second?.lanes.lanes).toHaveLength(2);
    expect(second && stripPath(second)).toHaveLength(4);
    expect(objectName(record, state.objects, t)).toBe('Batida «Ladera» · franja 2 de 2');
  });

  it('has no lanes once its area is gone', () => {
    const state = stateOf([
      ...PLANNED,
      {
        type: 'object-delete',
        origin: ANA,
        seq: 20,
        time: T0 + 20,
        object: { origin: ANA, seq: 1 },
      },
    ]);
    const record = state.objects.get(`${ANA}:2`);
    expect(record?.type === 'sweep' && stripOf(record, state.objects)).toBeNull();
  });

  it('tells who walks a strip the same on every device when two tasks along it share a second', () => {
    const along = (origin: NodeId): TeselEvent => ({
      type: 'task',
      origin,
      seq: 50,
      time: T0 + 50,
      task: { origin, seq: 50 },
      status: 'open',
      assignee: origin,
      place: { kind: 'object', object: { origin: ANA, seq: 2 } },
      text: 'Batida',
    });
    const walkers = [
      [along(ANA), along(BERTA)],
      [along(BERTA), along(ANA)],
    ].map((tasks) => stripWalker(stateOf([...PLANNED, ...tasks]).tasks, `${ANA}:2`));
    // Of events of the same second, the one of the greater origin is the newer (protocol §3.10).
    expect(walkers).toEqual([ANA, ANA]);
  });

  it('knows who walks a strip and how much of it their trail has swept', () => {
    // The last place again a minute later, as a device standing still publishes it: the walk is
    // borne out (ADR-0119).
    const walk = [at(0, 12), at(400, 13), at(400, 13)].map((point, index) => ({
      type: 'position' as const,
      origin: BERTA,
      seq: 30 + index,
      time: T0 + 30 + index * 60,
      ...point,
      accuracy: 5,
      heading: null,
      speed: null,
    }));
    const state = stateOf([...PLANNED, ...walk]);
    expect(stripWalker(state.tasks, `${ANA}:2`)).toBe(BERTA);
    const record = state.objects.get(`${ANA}:2`);
    const first = record?.type === 'sweep' ? stripOf(record, state.objects) : null;
    expect(first && sweptBy(first, state, BERTA)).toBeCloseTo(0.5, 1);
    // Berta's trail counts for her team, and not for one she has left for another.
    const team = (seq: number, id: string) => ({
      type: 'team' as const,
      origin: ANA,
      seq,
      time: T0 + seq,
      team: id as NodeId,
      colour: 'blue' as const,
      dissolved: false,
      members: [BERTA],
      name: id,
    });
    const moved = stateOf([...PLANNED, ...walk, team(40, '5eed0001'), team(41, '5eed0002')]);
    expect(first && sweptBy(first, moved, '5eed0001' as NodeId)).toBe(0);
    expect(first && sweptBy(first, moved, '5eed0002' as NodeId)).toBeCloseTo(0.5, 1);
  });

  it('marks the area cleared once every strip is done, from the device that finished last', () => {
    const half = stateOf([...PLANNED, task(14, 2, 'done', BERTA)]);
    expect(isStripDone(half.tasks, `${ANA}:2`)).toBe(true);
    expect(areasToClear(half, BERTA)).toEqual([]);
    const all = stateOf([...PLANNED, task(14, 2, 'done', ANA), task(15, 3, 'done', BERTA)]);
    expect(areasToClear(all, ANA)).toEqual([]);
    expect(areasToClear(all, BERTA)).toEqual([AREA]);
    const cleared = stateOf([
      ...PLANNED,
      task(14, 2, 'done', ANA),
      task(15, 3, 'done', BERTA),
      { ...AREA, seq: 16, time: T0 + 16, style: ShapeStyleCode.SEARCH_CLEARED },
    ]);
    expect(areasToClear(cleared, BERTA)).toEqual([]);
  });

  it('does not clear an area while a strip it was planned with is missing', () => {
    const done = [task(14, 2, 'done', ANA), task(15, 3, 'done', BERTA)];
    // The second strip deleted: its ground was never searched.
    const deleted = stateOf([
      ...PLANNED,
      ...done,
      {
        type: 'object-delete',
        origin: ANA,
        seq: 16,
        time: T0 + 16,
        object: { origin: ANA, seq: 3 },
      },
    ]);
    expect(areasToClear(deleted, BERTA)).toEqual([]);
    // The second strip not arrived yet over the radio: only the first is known.
    const late = stateOf([...PLANNED.filter((event) => event.seq !== 3), task(14, 2, 'done', ANA)]);
    expect(areasToClear(late, ANA)).toEqual([]);
  });
});

describe('marking a swept area cleared', () => {
  /** Ana's clock is an hour ahead: she renames the area while Berta finishes the last strip. */
  const AHEAD = 3600;
  const FINISHED = [
    ...PLANNED,
    task(14, 2, 'done', ANA),
    task(15, 3, 'done', BERTA),
    { ...AREA, seq: 20, time: T0 + AHEAD, label: 'Ladera norte' },
  ];

  /** Berta's device: what it publishes as it marks what is due, as the app does at each change. */
  function berta(start: GroupState) {
    const marks = new ClearingMarks();
    let state = start;
    let seq = 30;
    let chatSeq = 100;
    const published: TeselEvent[] = [];
    return {
      published,
      get state() {
        return state;
      },
      /** Marks what is due at `now`, in seconds, then takes a chat line from Ana. */
      run(now: number): void {
        for (const area of marks.due(state, BERTA, () => now * 1000)) {
          const mark = restyledShape(
            area,
            ShapeStyleCode.SEARCH_CLEARED,
          )({
            origin: BERTA,
            seq: seq++,
            time: now,
          });
          published.push(mark);
          state = reduce(state, mark);
        }
        state = reduce(state, { type: 'chat', origin: ANA, seq: chatSeq++, time: now, text: '…' });
      },
    };
  }

  it('waits for its clock to pass the area’s latest change, then marks it once and wins', () => {
    const device = berta(stateOf(FINISHED));
    for (let second = 16; second < 26; second++) device.run(T0 + second);
    expect(device.published).toEqual([]);
    device.run(T0 + AHEAD + 1);
    expect(device.published).toHaveLength(1);
    expect(device.state.objects.get(`${ANA}:1`)).toMatchObject({
      style: ShapeStyleCode.SEARCH_CLEARED,
      label: 'Ladera norte',
    });
    for (let second = 2; second < 12; second++) device.run(T0 + AHEAD + second);
    expect(device.published).toHaveLength(1);
  });

  it('marks a change once while the mark is on its way, and again only if it was not sent', () => {
    const state = stateOf(FINISHED);
    const marks = new ClearingMarks();
    const later = () => (T0 + AHEAD + 1) * 1000;
    const areas = marks.due(state, BERTA, later);
    expect(areas).toHaveLength(1);
    expect(marks.due(state, BERTA, later)).toEqual([]);
    const [area] = areas;
    if (area === undefined) throw new Error('no area');
    marks.failed(area);
    expect(marks.due(state, BERTA, later)).toEqual([area]);
  });
});
