// Where this device is: the one reading of the GPS that everything uses (sharing the position,
// following it on the map, navigating). The GPS runs only while something uses it, so nothing
// asks for the location, or spends battery on it, unless the user turned that something on. To
// save energy it can also run at intervals (`pace`): on for a fix every so often, off between.

import type { LatLon } from '@tesel/protocol';
import { untrack } from 'svelte';

export interface DeviceFix {
  readonly at: LatLon;
  /** Radius in metres within which the device is, as the browser estimates it. */
  readonly accuracy: number | null;
  /** Degrees clockwise from true north; known only while moving. */
  readonly heading: number | null;
  /** Metres per second; known only while moving. */
  readonly speed: number | null;
  /** When the fix was taken, in milliseconds since the epoch. */
  readonly time: number;
}

export type LocationProblem = 'denied' | 'unavailable';

/** The part of the browser's Geolocation API this module uses, so tests can stand in for it. */
export type GeolocationSource = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;

/** How long the GPS may take for a fix when it runs at intervals. */
const FIX_WINDOW_MS = 20_000;
/** A fix this sure ends a round at intervals at once: the GPS has the sky. */
const GOOD_FIX_M = 20;

export class DeviceLocation {
  /** The latest fix while the GPS runs; null before the first one and once it stops. */
  fix: DeviceFix | null = $state.raw(null);
  /** Why there is no fix, if the browser said so. Cleared by the next fix or when the GPS stops. */
  problem: LocationProblem | null = $state(null);
  /** Something uses the location, whether the GPS is on now or rests between fixes. */
  inUse = $state(false);

  /** Read when the GPS starts, so that the Android app can stand in for it first (lib/native). */
  readonly #source: () => GeolocationSource;
  /** Whoever uses the location now, each with what to do on a new fix. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, never rendered
  readonly #users = new Set<{ readonly onfix: ((fix: DeviceFix) => void) | undefined }>();
  #watch: number | null = null;
  /** Milliseconds between fixes while the GPS runs at intervals; null while it runs on. */
  #every: number | null = null;
  #nextFix: ReturnType<typeof setTimeout> | undefined;
  #giveUp: ReturnType<typeof setTimeout> | undefined;

  constructor(source: () => GeolocationSource = () => navigator.geolocation) {
    this.#source = source;
  }

  /**
   * Runs the GPS at intervals, `every` milliseconds, while something uses it: on until it has a
   * good fix or for FIX_WINDOW_MS at most, then off until the next one. Null runs it on again.
   * The latest fix stays meanwhile, so what shows where the device is does not go blank.
   */
  pace(every: number | null): void {
    if (every === this.#every) return;
    this.#every = every;
    clearTimeout(this.#nextFix);
    clearTimeout(this.#giveUp);
    if (this.#users.size === 0) return;
    if (every === null) {
      this.#start();
      return;
    }
    // A fix is taken at once, then every interval from it.
    this.#pause();
    this.#start();
  }

  /**
   * Keeps the GPS on until the returned function is called, and hands `onfix` the current fix, if
   * there is one, and each new one. Every user of the location calls this; the GPS stops when the
   * last one lets go. A still device may report no new fix for a long time, so a user that comes
   * while the GPS already runs starts from the fix others have.
   */
  use(onfix?: (fix: DeviceFix) => void): () => void {
    const user = { onfix };
    this.#users.add(user);
    this.inUse = true;
    this.#start();
    // Not tracked: an effect that calls `use` must not rerun, and restart the GPS, on every fix.
    const current = untrack(() => this.fix);
    if (current !== null) onfix?.(current);
    return () => {
      // Letting go twice is harmless: the second time, the user is already gone.
      if (this.#users.delete(user) && this.#users.size === 0) {
        this.inUse = false;
        this.#stop();
      }
    };
  }

  #start(): void {
    if (this.#watch !== null) return;
    if (this.#every !== null) {
      clearTimeout(this.#giveUp);
      this.#giveUp = setTimeout(() => {
        this.#rest();
      }, FIX_WINDOW_MS);
    }
    this.#watch = this.#source().watchPosition(
      (position) => {
        this.#receive(position);
      },
      (error) => {
        this.problem = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  #stop(): void {
    clearTimeout(this.#nextFix);
    clearTimeout(this.#giveUp);
    this.#pause();
    this.fix = null;
    this.problem = null;
  }

  /** Turns the GPS off, keeping the latest fix. */
  #pause(): void {
    if (this.#watch !== null) this.#source().clearWatch(this.#watch);
    this.#watch = null;
  }

  /** Between two fixes at intervals: off until the next one is due. */
  #rest(): void {
    const every = this.#every;
    if (every === null || this.#users.size === 0) return;
    clearTimeout(this.#giveUp);
    this.#pause();
    clearTimeout(this.#nextFix);
    this.#nextFix = setTimeout(() => {
      this.#start();
    }, every);
  }

  #receive(position: GeolocationPosition): void {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const fix: DeviceFix = {
      at: { lat: latitude, lon: longitude },
      accuracy: finiteOrNull(accuracy),
      heading: finiteOrNull(heading),
      speed: finiteOrNull(speed),
      time: position.timestamp,
    };
    this.fix = fix;
    this.problem = null;
    for (const { onfix } of this.#users) onfix?.(fix);
    // At intervals, a fix as good as the GPS gives in the open ends this round early.
    if (this.#every !== null && fix.accuracy !== null && fix.accuracy <= GOOD_FIX_M) this.#rest();
  }
}

/** This device's location, which every part of the app reads (ADR-0048). */
export const deviceLocation = new DeviceLocation();

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}
