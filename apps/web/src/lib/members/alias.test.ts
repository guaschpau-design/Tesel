import type { GroupState } from '@tesel/core';
import type { MemberInfoEvent, NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { aliasOf } from './alias.ts';

const MARTA = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
const THIRD = 'c0ffee01' as NodeId;
const LUIS = '12345678' as NodeId;

function info(origin: NodeId, alias: string, time: number): MemberInfoEvent {
  return {
    type: 'member-info',
    origin,
    seq: 1,
    time,
    role: 'member',
    publicKey: new Uint8Array(32),
    alias,
  };
}

const stateOf = (...members: MemberInfoEvent[]): Pick<GroupState, 'members'> => ({
  members: new Map(members.map((member) => [member.origin, member])),
});

describe('what to call a member', () => {
  it('tells apart members who go by the same name, the first keeping it as it is', () => {
    const state = stateOf(
      info(OTHER, 'marta ', 20),
      info(MARTA, 'Marta', 10),
      info(THIRD, 'Marta', 30),
      info(LUIS, 'Luis', 5),
    );
    expect(aliasOf(state, MARTA)).toBe('Marta');
    expect(aliasOf(state, OTHER)).toBe('marta ②');
    expect(aliasOf(state, THIRD)).toBe('Marta ③');
    expect(aliasOf(state, LUIS)).toBe('Luis');
  });

  it('calls a member it has no name for by their node ID', () => {
    expect(aliasOf(stateOf(), MARTA)).toBe(MARTA);
  });
});
