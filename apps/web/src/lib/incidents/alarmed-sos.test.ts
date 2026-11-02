import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { AlarmedSos } from './alarmed-sos.ts';

describe('SOS calls alarmed for', () => {
  it('raises each call of a group once, the same call of another group apart', () => {
    const alarmed = new AlarmedSos();
    expect(alarmed.claim('rescate', ['a:1', 'a:2', 'a:2'])).toEqual(['a:1', 'a:2']);
    expect(alarmed.claim('rescate', ['a:1', 'a:3'])).toEqual(['a:3']);
    expect(alarmed.claim('otro', ['a:1'])).toEqual(['a:1']);
  });

  it('remembers them across a reload', async () => {
    const db = await openAppDb('alarmed-sos-reload');
    const before = new AlarmedSos();
    await before.useStorage(db);
    before.claim('rescate', ['a:1']);
    const after = new AlarmedSos();
    await after.useStorage(db);
    expect(after.claim('rescate', ['a:1', 'a:2'])).toEqual(['a:2']);
  });
});
