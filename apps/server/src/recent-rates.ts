// How fast each key (a client address, a group) has done something lately, in times per second:
// a moving average that forgets the past over about WINDOW_MS. Keys idle long enough for their
// rate to fade to almost nothing are forgotten, so the map holds only the keys in use lately.

/** The average weighs the last WINDOW_MS most; what came before fades away exponentially. */
const WINDOW_MS = 10_000;
/** A rate below this, in times per second, is as good as none: the key is forgotten. */
const FORGOTTEN_BELOW = 0.01;
/** How often faded keys are looked for, at most. */
const SWEEP_EVERY_MS = 1000;

interface Entry {
  rate: number;
  at: number;
}

export class RecentRates {
  readonly #entries = new Map<string, Entry>();
  #sweptAt = -Infinity;

  /** The key's rate now, in times per second. */
  rate(key: string, now: number): number {
    const entry = this.#entries.get(key);
    return entry === undefined ? 0 : faded(entry, now);
  }

  /** Counts one more time for the key. */
  add(key: string, now: number): void {
    this.#sweep(now);
    this.#entries.set(key, { rate: this.rate(key, now) + 1000 / WINDOW_MS, at: now });
  }

  /** How many keys have done something lately. */
  keys(now: number): number {
    this.#sweep(now);
    return this.#entries.size;
  }

  #sweep(now: number): void {
    if (now - this.#sweptAt < SWEEP_EVERY_MS) return;
    this.#sweptAt = now;
    for (const [key, entry] of this.#entries) {
      if (faded(entry, now) < FORGOTTEN_BELOW) this.#entries.delete(key);
    }
  }
}

function faded(entry: Entry, now: number): number {
  return entry.rate * Math.exp(-Math.max(0, now - entry.at) / WINDOW_MS);
}
