// The other members' latest positions as GeoJSON for the map. This device is not among them: it
// is drawn where it is now (position/SelfLayer.svelte), not where it last reported being.

import { openSosCalls, teamOf, type GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { TEAM_COLOURS } from '../teams/teams.ts';
import type { Tone } from '../ui/theme.ts';
import { aliasOf } from './alias.ts';

/** A position older than this is drawn as stale. */
export const STALE_AFTER_S = 10 * 60;

interface MemberProperties {
  /** Node ID, used to select the member. */
  readonly id: NodeId;
  readonly label: string;
  readonly stale: boolean;
  /** The member has an SOS open: their name is always shown, however crowded the map. */
  readonly sos: boolean;
  /** Resting or off duty: drawn hollow, as not to be counted on now. */
  readonly away: boolean;
  /** Their team's colour, or `none` for the members' own. */
  readonly tone: Tone | 'none';
}

export type MemberCollection = FeatureCollection<Point, MemberProperties>;

export function memberFeatures(
  state: Pick<
    GroupState,
    'positions' | 'members' | 'memberStates' | 'teams' | 'sos' | 'sosCancels'
  >,
  self: NodeId,
  now: number,
): MemberCollection {
  const calling = new Set([...openSosCalls(state)].map(([, call]) => call.origin));
  const features: Feature<Point, MemberProperties>[] = [];
  for (const [origin, report] of state.positions) {
    if (report.type !== 'position' || origin === self) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [report.lon, report.lat] },
      properties: {
        id: origin,
        label: aliasOf(state, origin),
        stale: now - report.time > STALE_AFTER_S,
        sos: calling.has(origin),
        away: (state.memberStates.get(origin)?.status ?? 'active') !== 'active',
        tone: teamTone(state.teams, origin),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function teamTone(teams: GroupState['teams'], member: NodeId): Tone | 'none' {
  const team = teamOf(teams, member);
  return team ? TEAM_COLOURS[team.colour].tone : 'none';
}
