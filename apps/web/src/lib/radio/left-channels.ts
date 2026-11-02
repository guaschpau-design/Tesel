// The channels of groups this device left, still to be cleared from a radio: noted first, so that
// a clear the radio does not finish is tried again the next time one is linked. Only the group's
// id is kept for that, never its secret.

import type { RadioLink } from '@tesel/radio';

import { groupId } from '../groups/group.ts';
import type { AppDb } from '../storage/app-db.ts';

/** Notes that the channel of the group `id` is to be cleared from the radio. */
export async function noteLeftChannel(db: AppDb, id: string): Promise<void> {
  const pending = await channelsToFree(db);
  if (!pending.includes(id)) await db.put('settings', [...pending, id], 'radioChannelsToFree');
}

/** Clears from `link` the channels of groups left, and forgets them once cleared. */
export async function freeLeftChannels(db: AppDb, link: RadioLink): Promise<void> {
  const left = await channelsToFree(db);
  if (left.length === 0) return;
  await link.forgetChannels((held) => left.includes(groupId(held)));
  await db.delete('settings', 'radioChannelsToFree');
}

async function channelsToFree(db: AppDb): Promise<string[]> {
  const stored = await db.get('settings', 'radioChannelsToFree');
  return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
}
