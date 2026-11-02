// The members of a group as the panel lists them, team by team.

import { teamOf, type GroupState } from '@tesel/core';
import type { NodeId, Role, TeamEvent } from '@tesel/protocol';

import type { Heard } from '../links/heard.ts';
import { activeTeams } from '../teams/teams.ts';
import { aliasOf } from './alias.ts';
import { STALE_AFTER_S } from './member-features.ts';

export type PositionStatus = 'live' | 'stale' | 'hidden' | 'never';

export interface MemberRow {
  readonly id: NodeId;
  readonly alias: string;
  /** Null for a member whose MEMBER_INFO has not arrived yet. */
  readonly role: Role | null;
  readonly self: boolean;
  readonly position: PositionStatus;
  /** Their news reaches this device's radio lately, from their radio or through a bridge. */
  readonly byRadio: boolean;
  /** They say a LoRa radio is linked to their app (protocol §3.14). */
  readonly lora: boolean;
}

/** Everyone the group has heard from, this device first, then by alias. */
export function memberRows(
  state: GroupState,
  self: NodeId,
  now: number,
  heard: Heard,
): MemberRow[] {
  const ids = new Set<NodeId>([...state.members.keys(), ...state.positions.keys()]);
  const rows = [...ids].map((id): MemberRow => {
    const info = state.members.get(id);
    const report = state.positions.get(id);
    let position: PositionStatus = 'never';
    if (report?.type === 'position-hidden') position = 'hidden';
    else if (report) position = now - report.time > STALE_AFTER_S ? 'stale' : 'live';
    const radioTime = heard.get(id)?.radio;
    return {
      id,
      alias: aliasOf(state, id),
      role: info?.role ?? null,
      self: id === self,
      position,
      byRadio: radioTime !== undefined && now - radioTime <= STALE_AFTER_S,
      lora: state.memberStates.get(id)?.equipment.includes('lora') ?? false,
    };
  });
  return rows.sort((a, b) => Number(b.self) - Number(a.self) || a.alias.localeCompare(b.alias));
}

/** The rows by team: each team in use, by name, even if empty, then those in none. */
export function byTeam(
  rows: readonly MemberRow[],
  teams: GroupState['teams'],
): { readonly team: TeamEvent | null; readonly rows: MemberRow[] }[] {
  const groups = activeTeams(teams).map((team) => ({
    team,
    rows: rows.filter((row) => teamOf(teams, row.id)?.team === team.team),
  }));
  const loose = rows.filter((row) => teamOf(teams, row.id) === null);
  return loose.length > 0 || groups.length === 0
    ? [...groups, { team: null, rows: loose }]
    : groups;
}
