// Rate limiting: a bucket holds up to `capacity` tokens and refills continuously.

export class TokenBucket {
  readonly #capacity: number;
  readonly #perMs: number;
  #tokens: number;
  #updatedAt: number;

  constructor(capacity: number, refillPerSecond: number, now: number) {
    this.#capacity = capacity;
    this.#perMs = refillPerSecond / 1000;
    this.#tokens = capacity;
    this.#updatedAt = now;
  }

  /** Whether the bucket holds `count` tokens, without taking them. */
  has(now: number, count = 1): boolean {
    this.#refill(now);
    return this.#tokens >= count;
  }

  /** Takes `count` tokens if there are that many. */
  take(now: number, count = 1): boolean {
    if (!this.has(now, count)) return false;
    this.#tokens -= count;
    return true;
  }

  #refill(now: number): void {
    const elapsed = Math.max(0, now - this.#updatedAt);
    this.#tokens = Math.min(this.#capacity, this.#tokens + elapsed * this.#perMs);
    this.#updatedAt = now;
  }
}
