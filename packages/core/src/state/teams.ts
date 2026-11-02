// How the group is split for the work: the latest TEAM of each team (§3.15), the team each
// member is in, and who is in each.

import type { NodeId, TeamEvent } from '@tesel/protocol';

import { keepNewest, keepNewestAll } from '../collections.ts';
import { compareEvents } from '../ordering.ts';
import { defineSlice } from './slice.ts';

export const teams = defineSlice({
  handles: ['team'],
  empty: new Map() as ReadonlyMap<NodeId, TeamEvent>,
  apply: (state, event) => keepNewest(state, event.team, event),
  applyAll: (state, events) => keepNewestAll(state, events, (event) => event.team),
});

/** The team a member is in: of the teams that list them, the newest (§3.15); null if none. */
export function teamOf(state: ReadonlyMap<NodeId, TeamEvent>, member: NodeId): TeamEvent | null {
  let found: TeamEvent | null = null;
  for (const team of state.values()) {
    if (team.dissolved || !team.members.includes(member)) continue;
    if (found === null || compareEvents(team, found) > 0) found = team;
  }
  return found;
}

/**
 * Whom something for `assignee` is for: the members of the team it names, those it lists who are
 * in it by `teamOf` (none once it is dissolved), or else the member it names.
 */
export function membersFor(state: ReadonlyMap<NodeId, TeamEvent>, assignee: NodeId): NodeId[] {
  const team = state.get(assignee);
  if (team === undefined) return [assignee];
  return team.members.filter((member) => teamOf(state, member)?.team === assignee);
}
