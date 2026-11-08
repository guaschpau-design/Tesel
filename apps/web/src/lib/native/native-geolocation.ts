// The browser's Geolocation, as the web app uses it (position/device-location.svelte.ts), over
// Android's location (ADR-0125): a web view's own stops when the screen goes off, Android's goes
// on while the app keeps running. The first watch starts Android's location, the last cleared
// stops it.

import type { NativeFix, NativeFixProblem, TeselDevicePlugin } from './tesel-device.ts';

type Device = Pick<TeselDevicePlugin, 'watchLocation' | 'clearLocation' | 'addListener'>;

interface Watcher {
  readonly success: PositionCallback;
  readonly error: PositionErrorCallback | null | undefined;
}

const CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as const;

/** Geolocation's watchPosition and clearWatch over the Android app's plugin. */
export class NativeGeolocation implements Pick<Geolocation, 'watchPosition' | 'clearWatch'> {
  readonly #device: Device;
  readonly #watchers = new Map<number, Watcher>();
  #nextId = 1;
  #listening = false;

  constructor(device: Device) {
    this.#device = device;
  }

  watchPosition(success: PositionCallback, error?: PositionErrorCallback | null): number {
    const id = this.#nextId++;
    this.#watchers.set(id, { success, error });
    if (this.#watchers.size === 1) this.#start();
    return id;
  }

  clearWatch(id: number): void {
    if (!this.#watchers.delete(id) || this.#watchers.size > 0) return;
    this.#device.clearLocation().catch((reason: unknown) => {
      console.warn('Stopping the location failed', reason);
    });
  }

  #start(): void {
    if (!this.#listening) {
      this.#listening = true;
      void this.#device.addListener('fix', (fix) => {
        this.#position(fix);
      });
      void this.#device.addListener('fixProblem', (problem) => {
        this.#problem(problem);
      });
    }
    this.#device.watchLocation().catch((reason: unknown) => {
      console.warn('Starting the location failed', reason);
      this.#problem({ problem: 'unavailable' });
    });
  }

  #position(fix: NativeFix): void {
    const position = positionOf(fix);
    for (const watcher of this.#watchers.values()) watcher.success(position);
  }

  #problem({ problem }: NativeFixProblem): void {
    const code = problem === 'denied' ? CODES.PERMISSION_DENIED : CODES.POSITION_UNAVAILABLE;
    const error = { code, message: problem, ...CODES } as GeolocationPositionError;
    for (const watcher of this.#watchers.values()) watcher.error?.(error);
  }
}

/** A fix as the browser's Geolocation gives one. */
function positionOf(fix: NativeFix): GeolocationPosition {
  const coords = {
    latitude: fix.lat,
    longitude: fix.lon,
    accuracy: fix.accuracy ?? Number.NaN,
    heading: fix.heading,
    speed: fix.speed,
    altitude: null,
    altitudeAccuracy: null,
  };
  return { coords, timestamp: fix.time } as GeolocationPosition;
}
