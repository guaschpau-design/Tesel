import { encodeEvent, generateIdentity } from '@tesel/protocol';
import { plan, ScenarioPerformer, type Scenario } from '@tesel/scenario';
import { describe, expect, it } from 'vitest';

import { SCENARIOS } from './index.ts';

describe('bundled scenarios', () => {
  it('can all be planned', () => {
    for (const scenario of SCENARIOS.values()) {
      expect(plan(scenario, { positionEvery: 10 }).length).toBeGreaterThan(scenario.steps.length);
    }
  });

  it('name only their own members, objects and teams', async () => {
    for (const scenario of SCENARIOS.values()) {
      await expect(perform(scenario)).resolves.toBeGreaterThan(0);
    }
  });
});

/**
 * Performs every event of a scenario, as its members would send them, each encoded as it would go
 * on the wire; how many were sent.
 */
async function perform(scenario: Scenario): Promise<number> {
  const identities = new Map(scenario.members.map((member) => [member.alias, generateIdentity()]));
  const nodes = new Map([...identities].map(([alias, identity]) => [alias, identity.nodeId]));
  const performer = new ScenarioPerformer(nodes);
  let seq = 0;
  for (const event of plan(scenario, { positionEvery: 60 })) {
    const identity = identities.get(event.by);
    if (identity === undefined) throw new Error(`${event.by} is not a member`);
    const actor = { alias: event.by, publicKey: identity.publicKey };
    await performer.perform(event, actor, (draft) => {
      seq += 1;
      const sent = draft({ origin: identity.nodeId, seq, time: event.at });
      const encoded = encodeEvent(sent);
      if (!encoded.ok) throw new Error(`${sent.type} cannot be sent: ${encoded.error.detail}`);
      return Promise.resolve({ origin: identity.nodeId, seq });
    });
  }
  return seq;
}
