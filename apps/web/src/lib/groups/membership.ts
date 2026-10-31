// Joining, creating and leaving groups: the steps that touch more than one record.

import type { Invitation } from '@tesel/protocol';

import { deleteGroupEvents } from '../events/event-log.ts';
import type { AppDb } from '../storage/app-db.ts';
import {
  applyInvitation,
  createGroup,
  groupId,
  type JoinOutcome,
  type StoredGroup,
} from './group.ts';
import {
  deleteGroup,
  getGroup,
  listGroups,
  saveGroup,
  setActiveGroupId,
  takeBeforePractice,
} from './group-store.ts';

/** Joins (or re-joins) the group of an invitation and makes it the active group. */
export async function joinGroup(
  db: AppDb,
  invitation: Invitation,
  now: number,
): Promise<{ group: StoredGroup; outcome: JoinOutcome }> {
  const existing = await getGroup(db, groupId(invitation.secret));
  const result = applyInvitation(existing, invitation, now);
  await saveGroup(db, result.group);
  await setActiveGroupId(db, result.group.id);
  return result;
}

/** Creates a group coordinated by this device and makes it the active group. */
export async function startGroup(
  db: AppDb,
  name: string,
  server: string | null,
  now: number,
): Promise<StoredGroup> {
  const group = createGroup(name, server, now);
  await saveGroup(db, group);
  await setActiveGroupId(db, group.id);
  return group;
}

/**
 * Forgets a group and everything it left on this device, including its secret: the group first,
 * so that what is stored for it meanwhile is a leftover (`deleteLeftovers`).
 */
export async function leaveGroup(db: AppDb, id: string): Promise<void> {
  await deleteGroup(db, id);
  await deleteGroupEvents(db, id);
}

/**
 * Forgets the groups of the practice the app once had (ADR-0083), if one was left open when the
 * app changed, and makes the group used before it the active one again.
 */
export async function forgetPracticeGroups(db: AppDb): Promise<void> {
  const practices = (await listGroups(db)).filter((group) => 'practice' in group);
  for (const practice of practices) await leaveGroup(db, practice.id);
  const before = await takeBeforePractice(db);
  if (practices.length > 0 && before !== undefined && (await getGroup(db, before))) {
    await setActiveGroupId(db, before);
  }
}
