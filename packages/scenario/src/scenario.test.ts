import { describe, expect, it } from 'vitest';

import { plan, whereAt, type Scenario } from './scenario.ts';

const PATROL: Scenario = {
  name: 'patrol',
  description: 'Two members, one walking.',
  center: { lat: 39.47, lon: -0.37 },
  duration: 60,
  members: [
    {
      alias: 'Walker',
      route: [
        { lat: 39.47, lon: -0.37 },
        { lat: 39.47, lon: -0.369 },
      ],
      speed: 2,
    },
    { alias: 'Hidden', role: 'coordinator', route: [{ lat: 39.48, lon: -0.36 }], hidden: true },
  ],
  steps: [
    { at: 30, by: 'Hidden', action: { type: 'sos', id: 'help', kind: 'medical', text: '' } },
    { at: 40, by: 'Walker', action: { type: 'ack', of: 'help' } },
  ],
};

describe('scenario plan', () => {
  it('announces every member first, then sends events in time order', () => {
    const events = plan(PATROL, { positionEvery: 20 });
    expect(events.slice(0, 2).map((event) => event.action.type)).toEqual(['announce', 'announce']);
    expect(events.map((event) => event.at)).toEqual(
      [...events.map((event) => event.at)].sort((a, b) => a - b),
    );
    expect(events.find((event) => event.by === 'Hidden')?.action).toEqual({
      type: 'announce',
      role: 'coordinator',
    });
  });

  it('reports positions of walking members only, at the given interval', () => {
    const positions = plan(PATROL, { positionEvery: 20 }).filter(
      (event) => event.action.type === 'position',
    );
    expect(positions.map((event) => [event.by, event.at])).toEqual([
      ['Walker', 0],
      ['Walker', 20],
      ['Walker', 40],
      ['Walker', 60],
    ]);
  });

  it('places an SOS where its sender is at that moment', () => {
    const sos = plan(PATROL, { positionEvery: 20 }).find((event) => event.action.type === 'sos');
    expect(sos?.action).toMatchObject({ where: { lat: 39.48, lon: -0.36 } });
  });

  it('refuses a step by a member the scenario does not have', () => {
    const broken: Scenario = {
      ...PATROL,
      steps: [{ at: 1, by: 'Nobody', action: { type: 'chat', text: 'hola' } }],
    };
    expect(() => plan(broken, { positionEvery: 20 })).toThrow(/Nobody/);
  });
});

describe('walking a route', () => {
  const walker = PATROL.members[0];
  if (walker === undefined) throw new Error('no walker');

  it('starts at the first point and walks there and back', () => {
    // The route is about 86 m long; at 2 m/s the walker reaches its end in 43 s.
    expect(whereAt(walker, 0)).toEqual({ lat: 39.47, lon: -0.37 });
    expect(whereAt(walker, 43).lon).toBeCloseTo(-0.369, 4);
    expect(whereAt(walker, 86).lon).toBeCloseTo(-0.37, 4);
  });
});
