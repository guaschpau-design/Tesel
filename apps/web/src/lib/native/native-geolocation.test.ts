import { describe, expect, it, vi } from 'vitest';

import { NativeGeolocation } from './native-geolocation.ts';
import type { NativeFix, NativeFixProblem } from './tesel-device.ts';

/** A plugin that records what it is asked, and lets the test send fixes and problems. */
function fakeDevice() {
  const listeners: {
    fix: ((fix: NativeFix) => void)[];
    fixProblem: ((p: NativeFixProblem) => void)[];
  } = {
    fix: [],
    fixProblem: [],
  };
  const device = {
    watchLocation: vi.fn(() => Promise.resolve()),
    clearLocation: vi.fn(() => Promise.resolve()),
    addListener: vi.fn((event: 'fix' | 'fixProblem', listener: never) => {
      listeners[event].push(listener);
      return Promise.resolve({ remove: () => Promise.resolve() });
    }),
  };
  return { device, listeners };
}

const FIX: NativeFix = {
  lat: 39.47,
  lon: -0.38,
  accuracy: 6,
  heading: null,
  speed: 1.2,
  time: 1000,
};

describe("Android's location as the browser's", () => {
  it('starts with the first watch, stops with the last, and hands fixes to each', () => {
    const { device, listeners } = fakeDevice();
    const geolocation = new NativeGeolocation(device);
    const first = vi.fn();
    const second = vi.fn();
    const a = geolocation.watchPosition(first);
    const b = geolocation.watchPosition(second);
    expect(device.watchLocation).toHaveBeenCalledTimes(1);
    for (const listener of listeners.fix) listener(FIX);
    expect(first.mock.calls[0]?.[0]).toMatchObject({
      coords: { latitude: 39.47, longitude: -0.38, accuracy: 6, speed: 1.2 },
      timestamp: 1000,
    });
    expect(second).toHaveBeenCalledTimes(1);
    geolocation.clearWatch(a);
    expect(device.clearLocation).not.toHaveBeenCalled();
    geolocation.clearWatch(b);
    expect(device.clearLocation).toHaveBeenCalledTimes(1);
  });

  it('says why there is no fix as the browser does', () => {
    const { device, listeners } = fakeDevice();
    const geolocation = new NativeGeolocation(device);
    const error = vi.fn();
    geolocation.watchPosition(vi.fn(), error);
    for (const listener of listeners.fixProblem) listener({ problem: 'denied' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 1, PERMISSION_DENIED: 1 }));
  });

  it('listens once, however often it starts again', () => {
    const { device } = fakeDevice();
    const geolocation = new NativeGeolocation(device);
    geolocation.clearWatch(geolocation.watchPosition(vi.fn()));
    geolocation.watchPosition(vi.fn());
    expect(device.watchLocation).toHaveBeenCalledTimes(2);
    expect(device.addListener).toHaveBeenCalledTimes(2);
  });
});
