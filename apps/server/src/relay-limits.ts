// The relay's limits, which keep one client, one address or one group from taking the server for
// itself: open connections in all and per client address, groups the server does not know that
// one address may open, and pushes per connection, per group, per address and in all.

import { TokenBucket } from '@tesel/core';

import { KeyedBuckets } from './keyed-buckets.ts';

export interface RelayLimits {
  /**
   * Sustained pushes per second allowed to one connection, to a whole group, to one client
   * address and to the whole server. Each lets BURST_SECONDS' worth through at once.
   */
  readonly connectionPerSecond: number;
  readonly groupPerSecond: number;
  readonly addressPerSecond: number;
  readonly serverPerSecond: number;
  /** Open connections at most, in all and from one client address. */
  readonly maxConnections: number;
  readonly maxConnectionsPerAddress: number;
  /** Groups the server does not know that clients at one address may join in an hour. */
  readonly newGroupsPerAddressPerHour: number;
  /** A connection that has not joined a group by then is closed. */
  readonly joinTimeoutMs: number;
}

export const DEFAULT_LIMITS: RelayLimits = {
  connectionPerSecond: 3,
  groupPerSecond: 30,
  // Well below the server's: the connections one address may open could otherwise take it all.
  addressPerSecond: 100,
  serverPerSecond: 500,
  maxConnections: 10_000,
  // Phones behind a carrier's NAT share one address.
  maxConnectionsPerAddress: 256,
  newGroupsPerAddressPerHour: 120,
  joinTimeoutMs: 10_000,
};

/**
 * What the server lets all its clients leave unread together, shared out among the open
 * connections, and what one connection may leave at most and at least of it. A client that leaves
 * more is closed: a backlog page is far smaller than the least (500 envelopes of a few hundred
 * bytes), so only a client that has stopped reading gets there, and many of them together cannot
 * take the server's memory.
 */
const BUFFERED_BYTES_IN_ALL = 256 * 1024 * 1024;
const MAX_BUFFERED_BYTES = 1024 * 1024;
const MIN_BUFFERED_BYTES = 256 * 1024;

/** A push rate limit lets this many seconds' worth of pushes through at once. */
const BURST_SECONDS = 10;
const SECONDS_PER_HOUR = 3600;

/** Applies the limits; it counts connections, and keeps the buckets of pushes and new groups. */
export class Limiter {
  readonly #limits: RelayLimits;
  readonly #groupBuckets: KeyedBuckets;
  readonly #addressBuckets: KeyedBuckets;
  readonly #newGroupBuckets: KeyedBuckets;
  readonly #serverBucket: TokenBucket;
  readonly #connectionsByAddress = new Map<string, number>();
  #connections = 0;

  constructor(limits: RelayLimits, now: number) {
    this.#limits = limits;
    this.#groupBuckets = new KeyedBuckets(
      limits.groupPerSecond * BURST_SECONDS,
      limits.groupPerSecond,
    );
    this.#addressBuckets = new KeyedBuckets(
      limits.addressPerSecond * BURST_SECONDS,
      limits.addressPerSecond,
    );
    this.#newGroupBuckets = new KeyedBuckets(
      limits.newGroupsPerAddressPerHour,
      limits.newGroupsPerAddressPerHour / SECONDS_PER_HOUR,
    );
    this.#serverBucket = new TokenBucket(
      limits.serverPerSecond * BURST_SECONDS,
      limits.serverPerSecond,
      now,
    );
  }

  get joinTimeoutMs(): number {
    return this.#limits.joinTimeoutMs;
  }

  /** Whether one more connection from `address` is within the limits. */
  admits(address: string): boolean {
    return (
      this.#connections < this.#limits.maxConnections &&
      (this.#connectionsByAddress.get(address) ?? 0) < this.#limits.maxConnectionsPerAddress
    );
  }

  opened(address: string): void {
    this.#connections += 1;
    this.#connectionsByAddress.set(address, (this.#connectionsByAddress.get(address) ?? 0) + 1);
  }

  closed(address: string): void {
    this.#connections -= 1;
    const left = (this.#connectionsByAddress.get(address) ?? 1) - 1;
    if (left === 0) this.#connectionsByAddress.delete(address);
    else this.#connectionsByAddress.set(address, left);
  }

  /** What one connection may leave unread now, its share of what all may leave together. */
  maxBufferedBytes(): number {
    const share = BUFFERED_BYTES_IN_ALL / Math.max(1, this.#connections);
    return Math.max(MIN_BUFFERED_BYTES, Math.min(MAX_BUFFERED_BYTES, share));
  }

  /** Takes one of the address's new groups for this hour, if it has one left. */
  mayOpenGroup(address: string, now: number): boolean {
    return this.#newGroupBuckets.take(address, now);
  }

  /** A new connection's own push bucket. */
  connectionBucket(now: number): TokenBucket {
    const perSecond = this.#limits.connectionPerSecond;
    return new TokenBucket(perSecond * BURST_SECONDS, perSecond, now);
  }

  /**
   * Takes a push from the connection's, the group's, the address's and the server's buckets, if
   * all have one.
   */
  allowsPush(connectionBucket: TokenBucket, group: string, address: string, now: number): boolean {
    return (
      connectionBucket.take(now) &&
      this.#groupBuckets.take(group, now) &&
      this.#addressBuckets.take(address, now) &&
      this.#serverBucket.take(now)
    );
  }
}
