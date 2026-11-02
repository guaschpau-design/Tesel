// How far this device has read each group's envelopes on its server, and in which of the server's
// stores (protocol §8).

import { serverBaseUrl } from '@tesel/protocol';

import type { AppDb } from '../storage/app-db.ts';
import type { RelayPosition } from './relay-types.ts';

/** Where a group starts on a server it never synced with. */
export const START: RelayPosition = { cursor: 0, store: null };

/** The stored position, or the start if this device never synced the group with this server. */
export async function loadPosition(
  db: AppDb,
  groupId: string,
  server: string,
): Promise<RelayPosition> {
  return (await db.get('cursors', cursorKey(groupId, server))) ?? START;
}

export async function savePosition(
  db: AppDb,
  groupId: string,
  server: string,
  position: RelayPosition,
): Promise<void> {
  await db.put('cursors', position, cursorKey(groupId, server));
}

/** Where the position of a group on a server is stored, whatever form its address is written in. */
export function cursorKey(groupId: string, server: string): [string, string] {
  return [groupId, serverBaseUrl(server)];
}

/** The key range of every position of a group. */
export function groupCursors(groupId: string): IDBKeyRange {
  return IDBKeyRange.bound([groupId], [groupId, []]);
}
