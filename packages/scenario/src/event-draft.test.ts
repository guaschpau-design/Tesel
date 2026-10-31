import type { EventRef, NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { ScenarioPerformer, type EventDraft } from './event-draft.ts';
import { plan, type Scenario } from './scenario.ts';

const ANA = 'a1a1a1a1' as NodeId;
const LUIS = 'b2b2b2b2' as NodeId;
const BERTA = 'c3c3c3c3' as NodeId;
const NODES: Readonly<Record<string, NodeId>> = { Ana: ANA, Luis: LUIS, Berta: BERTA };
const HERE = { lat: 39.47, lon: -0.38 };

const SCENARIO: Scenario = {
  name: 'tasks',
  description: 'A coordinator who forms a team and gives it work.',
  center: HERE,
  duration: 60,
  members: [
    { alias: 'Ana', role: 'coordinator', route: [HERE] },
    { alias: 'Luis', route: [HERE] },
  ],
  steps: [
    {
      at: 1,
      by: 'Ana',
      action: {
        type: 'team',
        id: 'north',
        name: 'Norte',
        colour: 'blue',
        members: ['Luis', 'Berta'],
      },
    },
    {
      at: 2,
      by: 'Ana',
      action: {
        type: 'task',
        id: 'check',
        text: 'Revisar el almacén',
        assignee: 'north',
        place: null,
      },
    },
    { at: 3, by: 'Luis', action: { type: 'task-status', of: 'check', status: 'in-progress' } },
    {
      at: 4,
      by: 'Luis',
      action: {
        type: 'report',
        incident: 'fire',
        hazards: ['smoke'],
        access: 'difficult',
        casualties: { red: 0, yellow: 1, green: null, black: null },
        resources: ['firefighters'],
        note: 'Nave 3',
      },
    },
    {
      at: 5,
      by: 'Ana',
      action: {
        type: 'shape',
        id: 'sector',
        style: 1,
        label: 'Sector',
        geometry: { kind: 'polygon', points: [HERE, HERE, HERE] },
      },
    },
    {
      at: 6,
      by: 'Ana',
      action: {
        type: 'sweep',
        id: 'strip-1',
        area: 'sector',
        spacing: 20,
        heading: 90,
        strip: 0,
        strips: 2,
      },
    },
    { at: 7, by: 'Ana', action: { type: 'sos', id: 'help', kind: 'medical', text: '' } },
    { at: 8, by: 'Luis', action: { type: 'ack', of: 'help' } },
  ],
};

/** Plays a scenario's steps through a performer and returns the events sent. */
async function perform(scenario: Scenario): Promise<TeselEvent[]> {
  const performer = new ScenarioPerformer((name) => NODES[name]);
  const sent: TeselEvent[] = [];
  const seqs = new Map<NodeId, number>();
  for (const event of plan(scenario, { positionEvery: 600 })) {
    const origin = NODES[event.by] ?? BERTA;
    const actor = { alias: event.by, publicKey: new Uint8Array(32) };
    await performer.perform(event, actor, (draft: EventDraft): Promise<EventRef> => {
      const seq = (seqs.get(origin) ?? 0) + 1;
      seqs.set(origin, seq);
      sent.push(draft({ origin, seq, time: event.at }));
      return Promise.resolve({ origin, seq });
    });
  }
  return sent;
}

describe('performing a scenario', () => {
  it('forms a team of members and the user, under an ID of its own', async () => {
    const team = (await perform(SCENARIO)).find((event) => event.type === 'team');
    expect(team).toMatchObject({ name: 'Norte', colour: 'blue', members: [LUIS, BERTA] });
    expect([ANA, LUIS, BERTA]).not.toContain(team?.type === 'team' && team.team);
  });

  it('gives a task to a team by its name in the scenario, and moves it on whole', async () => {
    const sent = await perform(SCENARIO);
    const team = sent.find((event) => event.type === 'team');
    const tasks = sent.filter((event) => event.type === 'task');
    expect(tasks.map((task) => task.status)).toEqual(['open', 'in-progress']);
    const [created, taken] = tasks;
    expect(taken).toMatchObject({
      origin: LUIS,
      task: { origin: ANA, seq: created?.seq },
      text: 'Revisar el almacén',
      assignee: team?.type === 'team' ? team.team : null,
    });
  });

  it('sends a report from where its member is', async () => {
    const report = (await perform(SCENARIO)).find((event) => event.type === 'report');
    expect(report).toMatchObject({ place: { kind: 'point', at: HERE }, incident: 'fire' });
  });

  it('sweeps the area it names, and acknowledges the SOS it names', async () => {
    const sent = await perform(SCENARIO);
    const area = sent.find((event) => event.type === 'shape');
    expect(sent.find((event) => event.type === 'sweep')).toMatchObject({
      area: { origin: ANA, seq: area?.seq },
      strip: 0,
      strips: 2,
    });
    const call = sent.find((event) => event.type === 'sos');
    expect(sent.find((event) => event.type === 'ack')).toMatchObject({
      target: { origin: ANA, seq: call?.seq },
    });
  });

  it('changes a shape sent again under its id, which a sweep of it still names', async () => {
    const wider = { kind: 'polygon', points: [HERE, HERE, HERE, HERE] } as const;
    const grown: Scenario = {
      ...SCENARIO,
      steps: [
        ...SCENARIO.steps,
        {
          at: 9,
          by: 'Luis',
          action: { type: 'shape', id: 'sector', style: 1, label: 'Sector', geometry: wider },
        },
      ],
    };
    const sent = await perform(grown);
    const [first, second] = sent.filter((event) => event.type === 'shape');
    expect(second).toMatchObject({
      origin: LUIS,
      object: { origin: ANA, seq: first?.seq },
      geometry: wider,
    });
  });

  it('refuses a name nobody has', async () => {
    const stray: Scenario = {
      ...SCENARIO,
      steps: [
        {
          at: 1,
          by: 'Ana',
          action: { type: 'task', id: 'x', text: 'Algo', assignee: 'Nadie', place: null },
        },
      ],
    };
    await expect(perform(stray)).rejects.toThrow(/Nadie/);
  });
});
