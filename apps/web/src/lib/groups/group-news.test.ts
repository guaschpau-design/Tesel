import { EMPTY_STATE, reduceAll } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { groupNews, RECENT_S, type NewsState } from './group-news.ts';

const ANA = 'aaaaaaaa' as NodeId;
const BERTA = 'bbbbbbbb' as NodeId;
const NOW = 1_761_350_400;

function after(state: NewsState, ...events: TeselEvent[]): NewsState {
  return reduceAll({ ...EMPTY_STATE, ...state }, events);
}

const joins = (who: NodeId, time = NOW): TeselEvent => ({
  type: 'member-info',
  origin: who,
  seq: 1,
  time,
  role: 'member',
  publicKey: new Uint8Array(32),
  alias: who === ANA ? 'Ana' : 'Berta',
});

const task = (status: 'open' | 'in-progress' | 'done', by: NodeId, seq: number): TeselEvent => ({
  type: 'task',
  origin: by,
  seq,
  time: NOW,
  task: { origin: ANA, seq: 2 },
  status,
  assignee: BERTA,
  place: null,
  text: 'Revisar el almacén',
});

describe('what is news to a coordinator', () => {
  it('is someone else joining, lately', () => {
    const before = after(EMPTY_STATE, joins(ANA));
    expect(groupNews(before, after(before, joins(BERTA)), ANA, NOW)).toEqual([
      { kind: 'joined', who: BERTA },
    ]);
  });

  it('is not this device, nor what is caught up on after a while', () => {
    expect(groupNews(EMPTY_STATE, after(EMPTY_STATE, joins(ANA)), ANA, NOW)).toEqual([]);
    const old = after(EMPTY_STATE, joins(BERTA, NOW - RECENT_S - 1));
    expect(groupNews(EMPTY_STATE, old, ANA, NOW)).toEqual([]);
  });

  it('is a report from another member', () => {
    const report: TeselEvent = {
      type: 'report',
      origin: BERTA,
      seq: 3,
      time: NOW,
      place: null,
      incident: 'fire',
      hazards: [],
      access: 'unknown',
      casualties: { red: 1, yellow: null, green: null, black: null },
      resources: [],
      note: '',
    };
    const news = groupNews(EMPTY_STATE, after(EMPTY_STATE, report), ANA, NOW);
    expect(news).toMatchObject([{ kind: 'report', report: { origin: BERTA, incident: 'fire' } }]);
  });

  it('is a task started or finished by another member, once each', () => {
    const open = after(EMPTY_STATE, task('open', ANA, 2));
    const started = after(open, task('in-progress', BERTA, 4));
    expect(groupNews(open, started, ANA, NOW)).toMatchObject([
      { kind: 'task', task: { status: 'in-progress' } },
    ]);
    expect(groupNews(started, started, ANA, NOW)).toEqual([]);
    const done = after(started, task('done', BERTA, 5));
    expect(groupNews(started, done, ANA, NOW)).toMatchObject([
      { kind: 'task', task: { status: 'done' } },
    ]);
    // Changed by the coordinator: they know already.
    expect(groupNews(open, after(open, task('done', ANA, 6)), ANA, NOW)).toEqual([]);
  });

  it('is a danger area entered or the area of a task left, not the way back', () => {
    const crossing = (
      seq: number,
      kind: 'danger' | 'assigned',
      value: 'entered' | 'left',
    ): TeselEvent => ({
      type: 'zone-crossing',
      origin: BERTA,
      seq,
      time: NOW,
      zone: { origin: ANA, seq: 1 },
      crossing: value,
      kind,
      lat: 39.47,
      lon: -0.38,
      accuracy: 6,
    });
    const crossed = after(
      EMPTY_STATE,
      crossing(2, 'danger', 'entered'),
      crossing(3, 'danger', 'left'),
      crossing(4, 'assigned', 'entered'),
      crossing(5, 'assigned', 'left'),
    );
    expect(groupNews(EMPTY_STATE, crossed, ANA, NOW)).toMatchObject([
      { kind: 'crossing', crossing: { seq: 2 } },
      { kind: 'crossing', crossing: { seq: 5 } },
    ]);
    expect(groupNews(crossed, crossed, ANA, NOW)).toEqual([]);
    expect(groupNews(EMPTY_STATE, crossed, BERTA, NOW)).toEqual([]);
  });
});
