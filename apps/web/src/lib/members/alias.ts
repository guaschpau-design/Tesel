// What to call a member: their alias, or their node ID until their MEMBER_INFO arrives; and what
// to call whoever a task is for, a member or a team. Members who go by the same name are told
// apart (ADR-0096): the first to take it keeps it as it is, the others get a circled number
// after it, "Marta ②", the same on every device, so no one passes for another by copying a name.
// Names are shown without the characters no one sees (ADR-0110).

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

import { numberedNames } from '../names/names.ts';
import { shownText } from '../text.ts';

type Members = GroupState['members'];

/** Each members map's names, worked out once: a map is replaced, not changed, as members join. */
const namesOf = new WeakMap<Members, ReadonlyMap<NodeId, string>>();

export function aliasOf(state: Pick<GroupState, 'members'>, id: NodeId): string {
  return names(state.members).get(id) ?? id;
}

/** A team by its name (protocol §3.15), a member by their alias. */
export function nameOf(state: Pick<GroupState, 'members' | 'teams'>, id: NodeId): string {
  const team = state.teams.get(id);
  return team ? shownText(team.name) : aliasOf(state, id);
}

function names(members: Members): ReadonlyMap<NodeId, string> {
  let known = namesOf.get(members);
  if (known === undefined) {
    known = distinctNames(members);
    namesOf.set(members, known);
  }
  return known;
}

/**
 * Every member's name, told apart from the others that look the same (nameKey). The first to take
 * the name is whoever announced it earliest, by the time their own device wrote, then by node ID:
 * every device orders them the same way from the same events.
 */
function distinctNames(members: Members): ReadonlyMap<NodeId, string> {
  const ordered = [...members.values()].sort(
    (a, b) => a.time - b.time || a.origin.localeCompare(b.origin),
  );
  return numberedNames(ordered.map((info) => ({ key: info.origin, name: info.alias })));
}
