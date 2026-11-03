import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';

import { openAppDb } from './app-db.ts';

describe('app database', () => {
  it('upgrades a version 1 database to the current one without losing its groups', async () => {
    const v1 = await openDB('upgrade-test', 1, {
      upgrade(database) {
        database.createObjectStore('identity');
        database.createObjectStore('groups', { keyPath: 'id' });
        database.createObjectStore('settings');
      },
    });
    await v1.put('groups', { id: 'g1', name: 'Rescate' });
    v1.close();

    const db = await openAppDb('upgrade-test');
    expect(await db.get('groups', 'g1')).toMatchObject({ name: 'Rescate' });
    expect([...db.objectStoreNames].sort()).toEqual([
      'cursors',
      'events',
      'groups',
      'identity',
      'outbox',
      'radioTexts',
      'sequence',
      'settings',
      'weather',
    ]);
  });

  it('keeps the log and the outbox through an upgrade, and drops cursors of an unknown store', async () => {
    // Version 5 as it was: the outbox, an event and a cursor without its store.
    const v5 = await openDB('outbox-upgrade-test', 5, {
      upgrade(database) {
        for (const name of [
          'identity',
          'settings',
          'sequence',
          'radioTexts',
          'servers',
          'weather',
        ]) {
          database.createObjectStore(name);
        }
        database.createObjectStore('groups', { keyPath: 'id' });
        for (const name of ['events', 'outbox']) {
          database
            .createObjectStore(name, { keyPath: ['groupId', 'origin', 'seq'] })
            .createIndex('byGroup', 'groupId');
        }
        database.createObjectStore('cursors');
      },
    });
    const entry = { groupId: 'g1', origin: 'a1b2c3d4', seq: 7 };
    await v5.put('events', { ...entry, bytes: new Uint8Array([1, 2, 3]) });
    await v5.put('outbox', entry);
    await v5.put('sequence', 8, 'next');
    await v5.put('cursors', 41, ['g1', 'https://relay.example/']);
    v5.close();

    const db = await openAppDb('outbox-upgrade-test');
    expect(await db.getAll('outbox')).toEqual([entry]);
    expect(await db.getAll('events')).toHaveLength(1);
    expect(await db.get('sequence', 'next')).toBe(8);
    expect(await db.getAll('cursors')).toEqual([]);
    expect([...db.objectStoreNames]).not.toContain('servers');
  });

  it('lets a newer version have the database only once this window lets it go', async () => {
    const handOvers: (() => void)[] = [];
    await openAppDb('handed-over', {
      onBlocked: () => undefined,
      onReplaced: (letGo) => handOvers.push(letGo),
    });
    let blocked = false;
    const newer = openDB('handed-over', 100, {
      blocked: () => {
        blocked = true;
      },
    });
    await vi.waitFor(() => {
      expect(blocked).toBe(true);
    });
    expect(handOvers).toHaveLength(1);
    for (const letGo of handOvers) letGo();
    expect((await newer).version).toBe(100);
  });
});
