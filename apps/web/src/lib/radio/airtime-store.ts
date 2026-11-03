// The airtime the radio used in the last hour, kept on the device (ADR-0111): the duty cycle is
// the radio's, so a reload of the app, or another window that takes the radio, counts what was
// spent before instead of starting with a fresh budget.

import type { AirtimeUse } from '@tesel/core';

import type { AppDb } from '../storage/app-db.ts';

export async function loadAirtime(db: AppDb): Promise<AirtimeUse[]> {
  const stored = await db.get('settings', 'airtimeUsed');
  return Array.isArray(stored) ? stored.filter(isAirtimeUse) : [];
}

/** Keeps what the scheduler says was used in its window, which it has trimmed to the hour. */
export async function saveAirtime(db: AppDb, uses: readonly AirtimeUse[]): Promise<void> {
  await db.put('settings', uses, 'airtimeUsed');
}

function isAirtimeUse(value: unknown): value is AirtimeUse {
  if (typeof value !== 'object' || value === null) return false;
  const { at, ms } = value as Partial<Record<keyof AirtimeUse, unknown>>;
  return Number.isFinite(at) && Number.isFinite(ms);
}
