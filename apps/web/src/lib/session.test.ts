import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import { createGroup } from './groups/group.ts';
import { saveGroup, setActiveGroupId } from './groups/group-store.ts';
import { Session } from './session.svelte.ts';
import { openAppDb } from './storage/app-db.ts';

// Asking the browser to keep its storage, which Node cannot.
vi.mock('./storage/storage-space.svelte.ts', () => ({ keepStorage: () => Promise.resolve() }));

let dbCounter = 0;

describe('a practice left from before', () => {
  it('is forgotten when the app opens, and the group used before it is in use again', async () => {
    const db = await openAppDb(`session-test-${String(dbCounter++)}`);
    const ana = await Session.load(db);
    await ana.createIdentity('Ana');
    const team = await ana.createGroup('Rescate', null);
    // As the practice left them: its group in use, and the one before remembered.
    const practice = { ...createGroup('Práctica', null, Date.now()), practice: 'flood' };
    await saveGroup(db, practice);
    await setActiveGroupId(db, practice.id);
    await db.put('settings', team.id, 'beforePractice');

    const reopened = await Session.load(db);
    expect(reopened.groups.map((group) => group.name)).toEqual(['Rescate']);
    expect(reopened.activeGroupId).toBe(team.id);
  });
});

describe('the name of this device', () => {
  it('changes, and keeps its key, after the app is opened again', async () => {
    const db = await openAppDb(`session-test-${String(dbCounter++)}`);
    const ana = await Session.load(db);
    await ana.createIdentity('Ana');
    const node = ana.identity?.nodeId;
    await ana.renameIdentity('Ana G.');
    const reopened = await Session.load(db);
    expect(reopened.identity?.alias).toBe('Ana G.');
    expect(reopened.identity?.nodeId).toBe(node);
  });
});
