import { stateOf } from '@tesel/core';
import type { NodeId, TaskEvent, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  advance,
  assignedTo,
  byDoer,
  canMove,
  myPendingCount,
  newlyAssigned,
  taskList,
} from './tasks.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

function task(
  origin: NodeId,
  seq: number,
  time: number,
  fields: Partial<Omit<TaskEvent, 'type' | 'origin' | 'seq' | 'time'>> = {},
): TaskEvent {
  return {
    type: 'task',
    origin,
    seq,
    time,
    task: { origin, seq },
    status: 'open',
    assignee: null,
    place: null,
    text: `Tarea ${String(seq)}`,
    ...fields,
  };
}

const EVENTS: TeselEvent[] = [
  task(ANA, 1, T0, { text: 'Revisar el almacén' }),
  task(ANA, 2, T0 + 10, { assignee: BERTA, text: 'Llevar agua' }),
  task(BERTA, 1, T0 + 20, { text: 'Cortar la calle' }),
  // Berta starts Ana's first task, which nobody had taken.
  task(BERTA, 2, T0 + 30, {
    task: { origin: ANA, seq: 1 },
    status: 'in-progress',
    text: 'Revisar el almacén',
  }),
  task(ANA, 3, T0 + 40, { text: 'Ya hecha', status: 'done' }),
  task(ANA, 4, T0 + 50, { text: 'Anulada', status: 'cancelled' }),
];

describe('task list', () => {
  const state = stateOf(EVENTS);

  it('puts my tasks first, then those in progress, then the oldest', () => {
    const { pending } = taskList(state, BERTA);
    expect(pending.map((row) => row.fields.text)).toEqual([
      'Llevar agua',
      'Revisar el almacén',
      'Cortar la calle',
    ]);
    expect(pending[0]?.mine).toBe(true);
  });

  it('orders by creation, not by the last change', () => {
    const { pending } = taskList(state, ANA);
    expect(pending.map((row) => row.fields.text)).toEqual([
      'Revisar el almacén',
      'Llevar agua',
      'Cortar la calle',
    ]);
  });

  it('keeps done tasks apart and leaves cancelled ones out', () => {
    const { done, pending } = taskList(state, ANA);
    expect(done.map((row) => row.fields.text)).toEqual(['Ya hecha']);
    expect(pending.some((row) => row.fields.text === 'Anulada')).toBe(false);
  });

  it('shows who has what: this device first, then by name, then those for anyone', () => {
    const parts = (self: NodeId) =>
      byDoer(taskList(state, self).pending).map((part) => ({
        doer: part.doer,
        texts: part.rows.map((row) => row.fields.text),
      }));
    expect(parts(ANA)).toEqual([
      { doer: { kind: 'named', name: BERTA }, texts: ['Llevar agua'] },
      { doer: { kind: 'anyone' }, texts: ['Revisar el almacén', 'Cortar la calle'] },
    ]);
    expect(parts(BERTA)[0]).toEqual({ doer: { kind: 'you' }, texts: ['Llevar agua'] });
  });

  it('lets this device move along only its own tasks and those for anyone', () => {
    const rows = taskList(state, ANA).pending;
    expect(rows.map((row) => [row.fields.text, canMove(row)])).toEqual([
      ['Revisar el almacén', true],
      ['Llevar agua', false],
      ['Cortar la calle', true],
    ]);
  });

  it('counts the pending tasks of this device', () => {
    expect(myPendingCount(state, BERTA)).toBe(1);
    expect(myPendingCount(state, ANA)).toBe(0);
  });
});

describe('main button of a task', () => {
  const open = { status: 'open', assignee: null, place: null, text: 'x' } as const;

  it('takes a task for anyone when starting it', () => {
    expect(advance(open, ANA)).toMatchObject({ status: 'in-progress', assignee: ANA });
  });

  it('keeps the assignee of someone else’s task', () => {
    expect(advance({ ...open, assignee: BERTA }, ANA).assignee).toBe(BERTA);
  });

  it('finishes a task in progress and reopens a done one', () => {
    expect(advance({ ...open, status: 'in-progress' }, ANA).status).toBe('done');
    expect(advance({ ...open, status: 'done' }, ANA).status).toBe('open');
  });
});

describe('newly assigned tasks', () => {
  it('reports a task someone else hands to this device, once', () => {
    const before = assignedTo(stateOf(EVENTS), ANA);
    const handed = task(BERTA, 3, T0 + 60, { assignee: ANA, text: 'Para Ana' });
    const after = assignedTo(stateOf([...EVENTS, handed]), ANA);
    expect(newlyAssigned(before, after, ANA).map((item) => item.text)).toEqual(['Para Ana']);
    expect(newlyAssigned(after, after, ANA)).toEqual([]);
  });

  it('does not report a task this device took itself', () => {
    const before = assignedTo(stateOf(EVENTS), ANA);
    const taken = task(ANA, 5, T0 + 60, { assignee: ANA });
    const after = assignedTo(stateOf([...EVENTS, taken]), ANA);
    expect(newlyAssigned(before, after, ANA)).toEqual([]);
  });
});
