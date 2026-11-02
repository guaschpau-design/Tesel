import type { LatLon, SosKind } from '@tesel/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeviceFix } from '../position/device-location.svelte.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { callForHelp } from './call-for-help.ts';

const HERE = { lat: 39.47, lon: -0.37 };

function fakeFeed() {
  const calls: { at: LatLon | null; accuracy: number | null }[] = [];
  const shared: DeviceFix[] = [];
  const sosCancels = new Map<string, unknown>();
  const feed = {
    state: { sosCancels },
    sendSos: (_kind: SosKind, at: LatLon | null, accuracy: number | null) => {
      calls.push({ at, accuracy });
      return Promise.resolve({ origin: 'a1b2c3d4', seq: 3 });
    },
    sharePosition: (fix: DeviceFix) => {
      shared.push(fix);
      return Promise.resolve();
    },
  } as unknown as GroupFeed;
  return { feed, calls, shared, sosCancels };
}

describe('calling for help', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls from where the device is, and shares nothing more', async () => {
    const { feed, calls, shared } = fakeFeed();
    const use = vi.spyOn(deviceLocation, 'use');
    await callForHelp(feed, 'general', { at: HERE, accuracy: 8 }, '');
    expect(calls).toEqual([{ at: HERE, accuracy: 8 }]);
    expect(use).not.toHaveBeenCalled();
    expect(shared).toEqual([]);
  });

  it('follows a call with no place with the first fix, then lets the GPS go', async () => {
    const { feed, calls, shared } = fakeFeed();
    let onfix: ((fix: DeviceFix) => void) | undefined;
    const release = vi.fn();
    vi.spyOn(deviceLocation, 'use').mockImplementation((callback) => {
      onfix = callback;
      return release;
    });
    await callForHelp(feed, 'general', null, '');
    expect(calls).toEqual([{ at: null, accuracy: null }]);
    const fix = { at: HERE, accuracy: 5, heading: null, speed: null, time: 0 };
    onfix?.(fix);
    onfix?.(fix);
    await Promise.resolve();
    expect(shared).toEqual([fix]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('shares nothing once the call is cancelled', async () => {
    const { feed, shared, sosCancels } = fakeFeed();
    let onfix: ((fix: DeviceFix) => void) | undefined;
    const release = vi.fn();
    vi.spyOn(deviceLocation, 'use').mockImplementation((callback) => {
      onfix = callback;
      return release;
    });
    await callForHelp(feed, 'general', null, '');
    sosCancels.set('a1b2c3d4:3', {});
    onfix?.({ at: HERE, accuracy: 5, heading: null, speed: null, time: 0 });
    await Promise.resolve();
    expect(shared).toEqual([]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('lets the GPS go when no fix comes for a long while', async () => {
    vi.useFakeTimers();
    const { feed } = fakeFeed();
    const release = vi.fn();
    vi.spyOn(deviceLocation, 'use').mockReturnValue(release);
    await callForHelp(feed, 'general', null, '');
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(release).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
