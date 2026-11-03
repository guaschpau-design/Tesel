// Rate limits kept per key (a group, a client address): one token bucket each, with the same
// size and refill. A bucket left alone long enough to refill completely is the same as a new
// one, so it is forgotten then: the map only holds keys that used it lately, and coming back
// later never resets a limit early.

import { TokenBucket } from '@tesel/core';

/** How often idle buckets are looked for, at most. */
const SWEEP_EVERY_MS = 60_000;

interface Entry {
  readonly bucket: TokenBucket;
  lastTakeAt: number;
}

export class KeyedBuckets {
  readonly #capacity: number;
  readonly #perSecond: number;
  /** Time for an empty bucket to fill up again: after it, a bucket is as good as new. */
  readonly #refillMs: number;
  readonly #entries = new Map<string, Entry>();
  #sweptAt = -Infinity;

  constructor(capacity: number, perSecond: number) {
    this.#capacity = capacity;
    this.#perSecond = perSecond;
    this.#refillMs = (capacity / perSecond) * 1000;
  }

  /** Whether the key's bucket holds `count` tokens, without taking them. */
  has(key: string, now: number, count = 1): boolean {
    return this.#entries.get(key)?.bucket.has(now, count) ?? count <= this.#capacity;
  }

  /** Takes `count` tokens from the key's bucket if it has that many. */
  take(key: string, now: number, count = 1): boolean {
    this.#sweep(now);
    let entry = this.#entries.get(key);
    if (entry === undefined) {
      entry = { bucket: new TokenBucket(this.#capacity, this.#perSecond, now), lastTakeAt: now };
      this.#entries.set(key, entry);
    }
    entry.lastTakeAt = now;
    return entry.bucket.take(now, count);
  }

  /** Number of keys with a bucket that is not yet full again. */
  get size(): number {
    return this.#entries.size;
  }

  #sweep(now: number): void {
    if (now - this.#sweptAt < SWEEP_EVERY_MS) return;
    this.#sweptAt = now;
    for (const [key, entry] of this.#entries) {
      if (now - entry.lastTakeAt >= this.#refillMs) this.#entries.delete(key);
    }
  }
}
