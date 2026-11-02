import type { NodeId, TaskEvent, TeamEvent } from '@tesel/protocol';
import { describe, expect, it, vi } from 'vitest';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { dissolveTeam } from './team-actions.ts';

const ANA = 'a1b2c3d4' as NodeId;
const TEAM = '5eed0001' as NodeId;

const team: TeamEvent = {
  type: 'team',
  origin: ANA,
  seq: 1,
  time: 0,
  team: TEAM,
  colour: 'teal',
  dissolved: false,
  members: [ANA],
  name: 'Sur',
};

function task(seq: number, status: TaskEvent['status']): TaskEvent {
  return {
    type: 'task',
    origin: ANA,
    seq,
    time: 0,
    task: { origin: ANA, seq },
    status,
    assignee: TEAM,
    place: null,
    text: `Tarea ${String(seq)}`,
  };
}

describe('dissolving a team', () => {
  it('leaves what it still had to do for anyone, and what it did as it was', async () => {
    const writeTask = vi.fn<(task: unknown, fields: unknown) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const writeTeam = vi.fn<(team: unknown) => Promise<void>>(() => Promise.resolve());
    const tasks = new Map([
      ['a', task(2, 'open')],
      ['b', task(3, 'in-progress')],
      ['c', task(4, 'done')],
    ]);
    const feed = { state: { tasks }, writeTask, writeTeam } as unknown as GroupFeed;
    await dissolveTeam(feed, team);
    expect(writeTask.mock.calls.map(([ref, fields]) => [ref, fields])).toEqual([
      [{ origin: ANA, seq: 2 }, expect.objectContaining({ assignee: null, status: 'open' })],
      [{ origin: ANA, seq: 3 }, expect.objectContaining({ assignee: null, status: 'in-progress' })],
    ]);
    expect(writeTeam).toHaveBeenCalledWith(
      expect.objectContaining({ dissolved: true, members: [] }),
    );
  });
});
