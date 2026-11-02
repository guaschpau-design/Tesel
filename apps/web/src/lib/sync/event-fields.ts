// What some events hold besides their header, as the forms that fill them and the group feed that
// publishes them see it (protocol §3.14–3.16).

import type { EventHeader, MemberStateEvent, ReportEvent, TeamEvent } from '@tesel/protocol';

/** What REPORT holds besides its header (protocol §3.16). */
export type ReportFields = Omit<ReportEvent, keyof EventHeader | 'type'>;

/** What TEAM holds besides its header (protocol §3.15). */
export type TeamFields = Pick<TeamEvent, 'team' | 'colour' | 'dissolved' | 'members' | 'name'>;

/** What MEMBER_STATE tells about a member (protocol §3.14). */
export type MemberStateFields = Pick<
  MemberStateEvent,
  'profile' | 'status' | 'battery' | 'equipment'
>;

/** Nothing set: what the group assumes of a member who has said nothing. */
export function isUntold(state: MemberStateFields): boolean {
  return (
    state.profile === 'unspecified' &&
    state.status === 'active' &&
    state.battery === null &&
    state.equipment.length === 0
  );
}

export function sameState(a: MemberStateFields, b: MemberStateFields): boolean {
  return (
    a.profile === b.profile &&
    a.status === b.status &&
    a.battery === b.battery &&
    a.equipment.length === b.equipment.length &&
    a.equipment.every((item) => b.equipment.includes(item))
  );
}
