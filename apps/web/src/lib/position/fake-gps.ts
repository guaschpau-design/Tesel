// For tests: stands in for the browser's geolocation, so that a test decides when a fix or an
// error arrives. Like the browser, it tells only the watches still running.

import type { GeolocationSource } from './device-location.svelte.ts';

interface Watch {
  readonly success: PositionCallback;
  readonly error: PositionErrorCallback | null;
}

export class FakeGps implements GeolocationSource {
  readonly #watches = new Map<number, Watch>();
  #nextId = 1;

  /** How many watches are running. */
  get watching(): number {
    return this.#watches.size;
  }

  watchPosition(success: PositionCallback, error?: PositionErrorCallback | null): number {
    const id = this.#nextId++;
    this.#watches.set(id, { success, error: error ?? null });
    return id;
  }

  clearWatch(id: number): void {
    this.#watches.delete(id);
  }

  /** A fix at a place, taken `timestamp` milliseconds after the epoch, sure to `accuracy` metres. */
  fix(lat: number, lon: number, timestamp = 1_000, accuracy = 8): void {
    const coords = { latitude: lat, longitude: lon, accuracy, heading: NaN, speed: null };
    for (const { success } of this.#watches.values()) {
      success({ coords, timestamp } as unknown as GeolocationPosition);
    }
  }

  deny(): void {
    for (const { error } of this.#watches.values()) {
      error?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    }
  }
}
