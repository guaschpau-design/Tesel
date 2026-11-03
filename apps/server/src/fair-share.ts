// A capacity of pushes per second shared out fairly among the client addresses and the groups
// that use it. One token bucket holds it for all of them. While the bucket is more than half
// full, the capacity is not in short supply and any push takes from it. Below that, the capacity
// is contended, and an address or a group that has lately pushed more than an equal share of it,
// among the addresses or groups pushing lately, waits: the few that push hardest are held back to
// their share, while those that push less than it, honest members among them, still get through.

import { TokenBucket } from '@tesel/core';

import { RecentRates } from './recent-rates.ts';

export class FairShare {
  readonly #perSecond: number;
  readonly #bucket: TokenBucket;
  /** Tokens below which the capacity counts as contended: half the bucket. */
  readonly #contendedBelow: number;
  readonly #addresses = new RecentRates();
  readonly #groups = new RecentRates();

  /** `perSecond` sustained, with `burstSeconds`' worth at once. */
  constructor(perSecond: number, burstSeconds: number, now: number) {
    this.#perSecond = perSecond;
    this.#bucket = new TokenBucket(perSecond * burstSeconds, perSecond, now);
    this.#contendedBelow = (perSecond * burstSeconds) / 2;
  }

  /** Whether a push from `address` to `group` may take from the capacity now. */
  allows(address: string, group: string, now: number): boolean {
    if (!this.#bucket.has(now)) return false;
    if (this.#bucket.has(now, this.#contendedBelow)) return true;
    return (
      this.#addresses.rate(address, now) < this.#share(this.#addresses, now) &&
      this.#groups.rate(group, now) < this.#share(this.#groups, now)
    );
  }

  /** Takes the push, which `allows` let through, from the capacity. */
  take(address: string, group: string, now: number): void {
    this.#bucket.take(now);
    this.#addresses.add(address, now);
    this.#groups.add(group, now);
  }

  #share(rates: RecentRates, now: number): number {
    return this.#perSecond / Math.max(1, rates.keys(now));
  }
}
