// The limits on pushes: per connection, per group and per client address; the server's capacity,
// shared out fairly among addresses and groups (fair-share.ts), of which groups in their first
// day may take at most half, so groups with a history keep the rest whatever new ones do; and
// what an address, and a group in its first day, may store in a day. A push is let through only
// once every limit agrees, and only then counted against any of them.

import { TokenBucket } from '@tesel/core';

import { FairShare } from './fair-share.ts';
import { KeyedBuckets } from './keyed-buckets.ts';
import { BURST_SECONDS, type RelayLimits } from './relay-limits.ts';

/** Database bytes a stored envelope takes besides its own: keys, digest, cursor and indexes. */
const STORED_ENVELOPE_OVERHEAD = 250;
const MEGABYTE = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = DAY_MS / 1000;
/** The part of the server's pushes that groups in their first day may take between them. */
const FIRST_DAY_PART = 0.5;

/** Who pushes: one connection, its client address, and the group it joined. */
export interface Pusher {
  /** The connection's own push bucket, from `connectionBucket`. */
  readonly bucket: TokenBucket;
  readonly address: string;
  /** The group ID, base64url. */
  readonly group: string;
  /** When the group's first stored envelope arrived, or when it was first joined if it had none. */
  readonly groupSince: number;
}

export class PushLimiter {
  readonly #limits: RelayLimits;
  readonly #groups: KeyedBuckets;
  readonly #addresses: KeyedBuckets;
  readonly #server: FairShare;
  readonly #firstDayGroups: FairShare;
  readonly #addressBytes: KeyedBuckets;
  readonly #firstDayGroupBytes: KeyedBuckets;

  constructor(limits: RelayLimits, now: number) {
    this.#limits = limits;
    this.#groups = perSecond(limits.groupPerSecond);
    this.#addresses = perSecond(limits.addressPerSecond);
    this.#server = new FairShare(limits.serverPerSecond, BURST_SECONDS, now);
    this.#firstDayGroups = new FairShare(
      limits.serverPerSecond * FIRST_DAY_PART,
      BURST_SECONDS,
      now,
    );
    this.#addressBytes = perDay(limits.megabytesPerAddressPerDay);
    this.#firstDayGroupBytes = perDay(limits.megabytesPerGroupFirstDay);
  }

  /** A new connection's own push bucket. */
  connectionBucket(now: number): TokenBucket {
    const perSecond = this.#limits.connectionPerSecond;
    return new TokenBucket(perSecond * BURST_SECONDS, perSecond, now);
  }

  /**
   * Whether a push of an envelope of `bytes` is within every limit; if it is, it is taken from
   * the rates. What it stores is counted by `stored`, once the envelope proves to be new.
   */
  allows(pusher: Pusher, bytes: number, now: number): boolean {
    const { bucket, address, group } = pusher;
    const firstDay = isFirstDay(pusher, now);
    const cost = storedBytes(bytes);
    const agreed =
      bucket.has(now) &&
      this.#groups.has(group, now) &&
      this.#addresses.has(address, now) &&
      this.#server.allows(address, group, now) &&
      (!firstDay || this.#firstDayGroups.allows(address, group, now)) &&
      this.#addressBytes.has(address, now, cost) &&
      (!firstDay || this.#firstDayGroupBytes.has(group, now, cost));
    if (!agreed) return false;
    bucket.take(now);
    this.#groups.take(group, now);
    this.#addresses.take(address, now);
    this.#server.take(address, group, now);
    if (firstDay) this.#firstDayGroups.take(address, group, now);
    return true;
  }

  /** Counts a new envelope of `bytes`, which `allows` let through, against what may be stored. */
  stored(pusher: Pusher, bytes: number, now: number): void {
    const cost = storedBytes(bytes);
    this.#addressBytes.take(pusher.address, now, cost);
    if (isFirstDay(pusher, now)) this.#firstDayGroupBytes.take(pusher.group, now, cost);
  }
}

/** A key's own rate limit, BURST_SECONDS' worth at once. */
function perSecond(rate: number): KeyedBuckets {
  return new KeyedBuckets(rate * BURST_SECONDS, rate);
}

/** A key's own allowance of database bytes, a day's worth at once, refilled over the day. */
function perDay(megabytes: number): KeyedBuckets {
  return new KeyedBuckets(megabytes * MEGABYTE, (megabytes * MEGABYTE) / SECONDS_PER_DAY);
}

function storedBytes(envelopeBytes: number): number {
  return envelopeBytes + STORED_ENVELOPE_OVERHEAD;
}

function isFirstDay(pusher: Pusher, now: number): boolean {
  return now - pusher.groupSince < DAY_MS;
}
