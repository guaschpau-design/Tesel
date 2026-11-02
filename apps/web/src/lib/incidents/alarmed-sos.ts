// The SOS calls this device has raised the alarm for, by group (ADR-0104): each call sounds once,
// whether it arrives with its group open or by radio while the group is closed, and a reload does
// not sound it again. Kept in the settings, the newest `MAX_KEPT`, and read at start, before any
// group opens (storage/startup.svelte.ts).

import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';

/** Calls remembered at most, over every group: far more than are ever open at once. */
const MAX_KEPT = 500;

export class AlarmedSos {
  #db: AppDb | null = null;
  /** The calls alarmed for, as `<group id> <event key>`, oldest first. */
  #calls: readonly string[] = [];

  async useStorage(db: AppDb): Promise<void> {
    this.#db = db;
    const stored = await db.get('settings', 'alarmedSos');
    const calls = Array.isArray(stored)
      ? stored.filter((call): call is string => typeof call === 'string')
      : [];
    this.#calls = [...new Set([...calls, ...this.#calls])].slice(-MAX_KEPT);
  }

  /**
   * Of the calls `keys` (their events' keys) of the group `groupId`, those the alarm was never
   * raised for, which from now on count as raised.
   */
  claim(groupId: string, keys: readonly string[]): string[] {
    const known = new Set(this.#calls);
    const fresh = [...new Set(keys)].filter((key) => !known.has(`${groupId} ${key}`));
    if (fresh.length === 0) return [];
    this.#calls = [...this.#calls, ...fresh.map((key) => `${groupId} ${key}`)].slice(-MAX_KEPT);
    this.#db?.put('settings', this.#calls, 'alarmedSos').catch((error: unknown) => {
      // Kept in memory meanwhile: at worst, a reload sounds the call once more.
      console.warn('Keeping the SOS calls alarmed for failed', error);
      storageRefusals.note(error);
    });
    return fresh;
  }
}

/** The calls this device has raised the alarm for. */
export const alarmedSos = new AlarmedSos();
