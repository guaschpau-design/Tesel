import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadIdentity, saveIdentity } from './identity-store.ts';
import { aliasFault, createLocalIdentity, normalizeAlias } from './identity.ts';

describe('local identity', () => {
  it('accepts aliases of 1 to 32 bytes after trimming', () => {
    expect(normalizeAlias('  Pau ')).toBe('Pau');
    expect(normalizeAlias('')).toBeNull();
    expect(normalizeAlias('x'.repeat(33))).toBeNull();
  });

  it('refuses an alias with half of an emoji, which no event could carry', () => {
    expect(normalizeAlias('Pau 🚒')).toBe('Pau 🚒');
    expect(normalizeAlias(`Pau ${'🚒'.slice(1)}`)).toBeNull();
  });

  it('refuses an alias with a character that is not seen, and says so', () => {
    expect(normalizeAlias('Pau\u202E')).toBeNull();
    expect(aliasFault('Pa\u200Bu')).toBe('hidden');
    expect(aliasFault('Pau')).toBeNull();
  });

  it('survives a restart of the app', async () => {
    const db = await openAppDb('identity-test');
    expect(await loadIdentity(db)).toBeUndefined();
    const identity = createLocalIdentity('Pau', 1000);
    await saveIdentity(db, identity);
    db.close();
    const reopened = await openAppDb('identity-test');
    expect(await loadIdentity(reopened)).toEqual(identity);
  });
});
