// What is done with teams for the whole group: saved, with the members moved into a team taken out
// of the one they were in, and dissolved.

import { TEAM_MAX_MEMBERS, type TeamEvent } from '@tesel/protocol';

import type { GroupFeed, TeamFields } from '../sync/group-feed.svelte.ts';
import { activeTeams } from './teams.ts';

/**
 * Saves a team; its members leave any other team, which is saved without them (§3.15). A team
 * too large to send is refused before any other team is touched.
 */
export async function saveTeam(feed: GroupFeed, team: TeamFields): Promise<void> {
  if (team.members.length > TEAM_MAX_MEMBERS) {
    throw new RangeError(`a team holds at most ${String(TEAM_MAX_MEMBERS)} members`);
  }
  for (const other of activeTeams(feed.state.teams)) {
    if (other.team === team.team) continue;
    const staying = other.members.filter((member) => !team.members.includes(member));
    if (staying.length < other.members.length) {
      await feed.writeTeam({ ...fieldsOf(other), members: staying });
    }
  }
  await feed.writeTeam(team);
}

/** Dissolves a team: it is no longer shown, and its members are in none. */
export async function dissolveTeam(feed: GroupFeed, team: TeamEvent): Promise<void> {
  await feed.writeTeam({ ...fieldsOf(team), dissolved: true, members: [] });
}

function fieldsOf(team: TeamEvent): TeamFields {
  const { colour, dissolved, members, name } = team;
  return { team: team.team, colour, dissolved, members, name };
}
