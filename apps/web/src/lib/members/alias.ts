// What to call a member: their alias, or their node ID until their MEMBER_INFO arrives; and what
// to call whoever a task is for, a member or a team. Members who go by the same name are told
// apart (ADR-0096): the first to take it keeps it as it is, the others get a circled number
// after it, "Marta ②", the same on every device, so no one passes for another by copying a name.

import type { GroupState } from '@tesel/core';
import type { MemberInfoEvent, NodeId } from '@tesel/protocol';

type Members = GroupState['members'];

/** Circled numbers for the second to the twentieth member of a name; then "(21)" and on. */
const CIRCLED = '②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/** Each members map's names, worked out once: a map is replaced, not changed, as members join. */
const namesOf = new WeakMap<Members, ReadonlyMap<NodeId, string>>();

export function aliasOf(state: Pick<GroupState, 'members'>, id: NodeId): string {
  return names(state.members).get(id) ?? id;
}

/** A team by its name (protocol §3.15), a member by their alias. */
export function nameOf(state: Pick<GroupState, 'members' | 'teams'>, id: NodeId): string {
  return state.teams.get(id)?.name ?? aliasOf(state, id);
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
 * Every member's name, told apart from the others of the same alias, compared regardless of case
 * and spaces. The first to take the name is whoever announced it earliest, then by node ID: every
 * device orders them the same way from the same events.
 */
function distinctNames(members: Members): Map<NodeId, string> {
  const byName = new Map<string, MemberInfoEvent[]>();
  for (const info of members.values()) {
    const key = info.alias.trim().toLocaleLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), info]);
  }
  const result = new Map<NodeId, string>();
  for (const same of byName.values()) {
    same.sort((a, b) => a.time - b.time || a.origin.localeCompare(b.origin));
    same.forEach((info, index) => {
      result.set(
        info.origin,
        index === 0 ? info.alias : `${info.alias.trim()} ${ordinal(index + 1)}`,
      );
    });
  }
  return result;
}

function ordinal(position: number): string {
  return CIRCLED[position - 2] ?? `(${String(position)})`;
}
