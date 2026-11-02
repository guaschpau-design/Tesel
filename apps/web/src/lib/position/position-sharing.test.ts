import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import { createGroup } from '../groups/group.ts';
import { createLocalIdentity } from '../identity/identity.ts';
import { loadPreferences } from '../settings/preferences.ts';
import { openAppDb, type AppDb } from '../storage/app-db.ts';
import { GroupFeed } from '../sync/group-feed.svelte.ts';
import { DeviceLocation } from './device-location.svelte.ts';
import { FakeGps } from './fake-gps.ts';
import { hideInOtherGroups } from './hide-position.ts';
import { PositionSharing } from './position-sharing.svelte.ts';

let databases = 0;

/** No other group to hide the position in. */
const NOWHERE_ELSE = () => Promise.resolve();

/** Ana's device in a group with no server, sharing in its remembered mode. */
async function anaDevice(db?: AppDb) {
  const database = db ?? (await openAppDb(`position-sharing-${String(++databases)}`));
  const ana = createLocalIdentity('Ana', 0);
  const feed = await GroupFeed.open(database, createGroup('Rescate', null, 0), ana);
  const gps = new FakeGps();
  const mode = (await loadPreferences(database)).positionMode;
  const sharing = new PositionSharing(mode, new DeviceLocation(gps), NOWHERE_ELSE);
  sharing.attach(feed);
  /** What the group's map shows of Ana: her last position, or that she hid it. */
  const onTheMap = () => feed.state.positions.get(ana.nodeId);
  /** The latitudes of Ana's trail, oldest first: every position published since she last hid. */
  const trail = () => feed.state.trails.get(ana.nodeId)?.points.map((point) => point.lat) ?? [];
  return { db: database, gps, sharing, onTheMap, trail };
}

describe('sharing this device’s position', () => {
  it('keeps the GPS off and publishes nothing until the user shares', async () => {
    const { gps, onTheMap } = await anaDevice();
    expect(gps.watching).toBe(0);
    gps.fix(39.47, -0.37);
    expect(onTheMap()).toBeUndefined();
  });

  it('publishes the position while sharing', async () => {
    const { gps, sharing, onTheMap } = await anaDevice();
    await sharing.setMode('sharing');
    expect(gps.watching).toBe(1);
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()).toMatchObject({ type: 'position', lat: 39.47, lon: -0.37 });
    });
  });

  it('standing still with a wandering GPS, stays where it was published', async () => {
    const { gps, sharing, trail } = await anaDevice();
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37, 1_000, 25);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.47]);
    });
    // Twenty metres off within ±25 m: the GPS wandering, not a move.
    gps.fix(39.4702, -0.37, 30_000, 25);
    // A minute on, the heartbeat publishes the same place again.
    gps.fix(39.4698, -0.37, 61_000, 25);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.47, 39.47]);
    });
  });

  it('once paused, publishes nothing new and leaves the last position to turn stale', async () => {
    const { gps, sharing, onTheMap, trail } = await anaDevice();
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()?.type).toBe('position');
    });
    await sharing.setMode('paused');
    expect(gps.watching).toBe(0);
    gps.fix(39.5, -0.4, 120_000);
    expect(onTheMap()).toMatchObject({ type: 'position', lat: 39.47, lon: -0.37 });
    // Sharing again shows that nothing was published meanwhile.
    await sharing.setMode('sharing');
    gps.fix(39.6, -0.5, 240_000);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.47, 39.6]);
    });
  });

  it('once hidden, takes the device off the group’s map and publishes nothing after', async () => {
    const { gps, sharing, onTheMap, trail } = await anaDevice();
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()?.type).toBe('position');
    });
    await sharing.setMode('hidden');
    expect(onTheMap()?.type).toBe('position-hidden');
    expect(gps.watching).toBe(0);
    expect(trail()).toEqual([]);
    gps.fix(39.5, -0.4, 120_000);
    // Sharing again shows that nothing was published meanwhile.
    await sharing.setMode('sharing');
    gps.fix(39.6, -0.5, 240_000);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.6]);
    });
  });

  it('hides the position in a group it was shared with, once the user hid it elsewhere', async () => {
    const db = await openAppDb(`position-sharing-${String(++databases)}`);
    const ana = createLocalIdentity('Ana', 0);
    const rescue = await GroupFeed.open(db, createGroup('Rescate', null, 0), ana);
    const other = await GroupFeed.open(db, createGroup('Otro', null, 0), ana);
    const gps = new FakeGps();
    const sharing = new PositionSharing(
      (await loadPreferences(db)).positionMode,
      new DeviceLocation(gps),
      NOWHERE_ELSE,
    );
    sharing.attach(rescue);
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(rescue.showsOwnPosition).toBe(true);
    });
    sharing.attach(other);
    await sharing.setMode('hidden');
    expect(rescue.showsOwnPosition).toBe(true);
    sharing.attach(rescue);
    await vi.waitFor(() => {
      expect(rescue.showsOwnPosition).toBe(false);
    });
  });

  it('hides the position at once in the other groups too, when the user hides it', async () => {
    const db = await openAppDb(`position-sharing-${String(++databases)}`);
    const ana = createLocalIdentity('Ana', 0);
    const rescueGroup = createGroup('Rescate', null, 0);
    const otherGroup = createGroup('Otro', null, 0);
    const rescue = await GroupFeed.open(db, rescueGroup, ana);
    const gps = new FakeGps();
    const sharing = new PositionSharing(
      (await loadPreferences(db)).positionMode,
      new DeviceLocation(gps),
      () => hideInOtherGroups(db, [rescueGroup, otherGroup], ana, otherGroup.id),
    );
    sharing.attach(rescue);
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(rescue.showsOwnPosition).toBe(true);
    });
    rescue.close();
    sharing.attach(await GroupFeed.open(db, otherGroup, ana));
    await sharing.setMode('hidden');
    await vi.waitFor(async () => {
      const reopened = await GroupFeed.open(db, rescueGroup, ana);
      reopened.close();
      expect(reopened.showsOwnPosition).toBe(false);
    });
  });

  it('remembers the choice, so sharing resumes when the app starts again', async () => {
    const first = await anaDevice();
    await first.sharing.setMode('sharing');
    const restarted = await anaDevice(first.db);
    expect(restarted.sharing.mode).toBe('sharing');
    expect(restarted.gps.watching).toBe(1);
  });
});
