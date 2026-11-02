// Where heard text messages of other apps (radio-texts.ts) are kept: a store of the app's database.

import type { AppDb } from '../storage/app-db.ts';
import { MAX_RADIO_TEXTS, type StoredRadioText } from './radio-texts.ts';

export async function loadRadioTexts(db: AppDb): Promise<StoredRadioText[]> {
  return db.getAll('radioTexts');
}

/** Stores a message and drops the oldest ones beyond the limit. */
export async function saveRadioText(db: AppDb, text: StoredRadioText): Promise<void> {
  const tx = db.transaction('radioTexts', 'readwrite');
  await tx.store.add(text);
  const keys = await tx.store.getAllKeys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_RADIO_TEXTS))) {
    await tx.store.delete(key);
  }
  await tx.done;
}
