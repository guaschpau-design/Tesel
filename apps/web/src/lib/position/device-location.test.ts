import { describe, expect, it, vi } from 'vitest';

import { DeviceLocation } from './device-location.svelte.ts';
import { FakeGps } from './fake-gps.ts';

describe('device location', () => {
  it('runs the GPS once however many use it, and stops when the last one lets go', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const releaseMap = location.use();
    const releaseSharing = location.use();
    expect(gps.watching).toBe(1);
    releaseMap();
    releaseMap();
    expect(gps.watching).toBe(1);
    releaseSharing();
    expect(gps.watching).toBe(0);
  });

  it('hands each fix to its listeners, with unknown values as null', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const heard: unknown[] = [];
    location.use((fix) => heard.push(fix));
    gps.fix(39.47, -0.37);
    const expected = {
      at: { lat: 39.47, lon: -0.37 },
      accuracy: 8,
      heading: null,
      speed: null,
      time: 1_000,
    };
    expect(heard).toEqual([expected]);
    expect(location.fix).toEqual(expected);
  });

  it('hands a newcomer the fix the GPS already has', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    location.use();
    gps.fix(39.47, -0.37);
    const heard: unknown[] = [];
    location.use((fix) => heard.push(fix));
    expect(heard).toHaveLength(1);
  });

  it('forgets the fix and the problem when the GPS stops', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const release = location.use();
    gps.deny();
    expect(location.problem).toBe('denied');
    gps.fix(39.47, -0.37);
    expect(location.problem).toBeNull();
    release();
    expect(location.fix).toBeNull();
  });

  it('runs the GPS at intervals while paced, keeping the latest fix between them', () => {
    vi.useFakeTimers();
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const fixes: number[] = [];
    const release = location.use((fix) => fixes.push(fix.at.lat));
    location.pace(60_000);
    expect(gps.watching).toBe(1);
    gps.fix(39.47, -0.37, 1_000, 8);
    // A good fix ends the round: off until the next one, the fix kept.
    expect(gps.watching).toBe(0);
    expect(location.fix?.at.lat).toBe(39.47);
    vi.advanceTimersByTime(60_000);
    expect(gps.watching).toBe(1);
    // No good fix in time: off anyway, with what it had.
    gps.fix(39.48, -0.37, 2_000, 60);
    vi.advanceTimersByTime(20_000);
    expect(gps.watching).toBe(0);
    expect(fixes).toEqual([39.47, 39.48]);
    location.pace(null);
    expect(gps.watching).toBe(1);
    release();
    expect(gps.watching).toBe(0);
    vi.useRealTimers();
  });
});
