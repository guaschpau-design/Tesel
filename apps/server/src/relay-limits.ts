// The relay's limits, which keep one client, one address or one group from taking the server for
// itself: open connections in all and per client address, joins and groups the server does not
// know per address, messages per connection, and what clients may leave unread. The limits on
// pushes are push-limits.ts's.

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
  /**
   * What one client address, and one group in its first day, may store in a day, in megabytes
   * of database: an envelope counts with the keys and indexes stored beside it (push-limits.ts).
   */
  readonly megabytesPerAddressPerDay: number;
  readonly megabytesPerGroupFirstDay: number;
  /** Open connections at most, in all and from one client address. */
  readonly maxConnections: number;
  readonly maxConnectionsPerAddress: number;
  /**
   * What all clients together may leave unread, in megabytes; it is shared out among the open
   * connections, so it must leave each of `maxConnections` at least LEAST_UNREAD_BYTES.
   */
  readonly unreadMegabytes: number;
  /** Groups the server does not know that clients at one address may join in an hour. */
  readonly newGroupsPerAddressPerHour: number;
  /**
   * Joins per second from one client address, once it has joined as many groups at once as it
   * may open connections (all of them coming back after the server restarted).
   */
  readonly joinsPerAddressPerSecond: number;
  /** Messages of any kind per second from one connection, BURST_SECONDS' worth at once. */
  readonly messagesPerSecond: number;
  /** A connection that has not joined a group by then is closed. */
  readonly joinTimeoutMs: number;
}

/**
 * Sized to the server's container (deploy/vps/compose.yaml, 512 MB): Node with the site, the app
 * and the database takes some 150 MB, each open connection about 11 KB, so 10 000 of them some
 * 110 MB, and what they leave unread its 96 MB and at most as much again in the buffers' own
 * bookkeeping: some 450 MB at worst. Each connection may then leave at least 96 MB / 10 000,
 * about 10 KB, unread (ADR-0107).
 */
export const DEFAULT_LIMITS: RelayLimits = {
  connectionPerSecond: 3,
  groupPerSecond: 30,
  // Well below the server's: the connections one address may open could otherwise take it all.
  addressPerSecond: 100,
  serverPerSecond: 500,
  // Far above what a busy operation stores (a member moving all day sends some 5 MB): only a
  // flood gets there.
  megabytesPerAddressPerDay: 512,
  megabytesPerGroupFirstDay: 256,
  maxConnections: 10_000,
  // Phones behind a carrier's NAT share one address.
  maxConnectionsPerAddress: 256,
  unreadMegabytes: 96,
  newGroupsPerAddressPerHour: 120,
  joinsPerAddressPerSecond: 2,
  // A client paces its pushes at 2 a second and pings every 25 seconds (apps/web).
  messagesPerSecond: 10,
  joinTimeoutMs: 10_000,
};

/** The least a connection may leave unread: a few dozen envelopes. */
export const LEAST_UNREAD_BYTES = 8 * 1024;
/** The most a connection may leave unread, however few others there are. */
const MOST_UNREAD_BYTES = 1024 * 1024;
const MEGABYTE = 1024 * 1024;

/** A rate limit lets this many seconds' worth through at once. */
export const BURST_SECONDS = 10;
const SECONDS_PER_HOUR = 3600;
/** Refused messages a connection may send at once, and how often one more, before it is closed. */
const REFUSED_AT_ONCE = 10;
const REFUSED_PER_SECOND = 1 / 60;

/** One connection's own budgets: messages of any kind, and messages the server refused. */
export interface ConnectionBudget {
  readonly messages: TokenBucket;
  readonly refused: TokenBucket;
}

/** Applies the limits; it counts connections, and keeps the buckets of joins and new groups. */
export class Limiter {
  readonly #limits: RelayLimits;
  readonly #joinBuckets: KeyedBuckets;
  readonly #newGroupBuckets: KeyedBuckets;
  readonly #connectionsByAddress = new Map<string, number>();
  #connections = 0;

  constructor(limits: RelayLimits) {
    this.#limits = limits;
    this.#joinBuckets = new KeyedBuckets(
      limits.maxConnectionsPerAddress,
      limits.joinsPerAddressPerSecond,
    );
    this.#newGroupBuckets = new KeyedBuckets(
      limits.newGroupsPerAddressPerHour,
      limits.newGroupsPerAddressPerHour / SECONDS_PER_HOUR,
    );
  }

  get joinTimeoutMs(): number {
    return this.#limits.joinTimeoutMs;
  }

  /** What all clients together may leave unread, in bytes. */
  get unreadBytesInAll(): number {
    return this.#limits.unreadMegabytes * MEGABYTE;
  }

  /** Whether one more connection from `address` is within the limits. */
  admits(address: string): boolean {
    return (
      this.#connections < this.#limits.maxConnections &&
      (this.#connectionsByAddress.get(address) ?? 0) < this.#limits.maxConnectionsPerAddress
    );
  }

  /** Counts a new connection from `address`, and gives it its own budgets. */
  opened(address: string, now: number): ConnectionBudget {
    this.#connections += 1;
    this.#connectionsByAddress.set(address, (this.#connectionsByAddress.get(address) ?? 0) + 1);
    const perSecond = this.#limits.messagesPerSecond;
    return {
      messages: new TokenBucket(perSecond * BURST_SECONDS, perSecond, now),
      refused: new TokenBucket(REFUSED_AT_ONCE, REFUSED_PER_SECOND, now),
    };
  }

  closed(address: string): void {
    this.#connections -= 1;
    const left = (this.#connectionsByAddress.get(address) ?? 1) - 1;
    if (left === 0) this.#connectionsByAddress.delete(address);
    else this.#connectionsByAddress.set(address, left);
  }

  /**
   * What one connection may leave unread now: an equal part of what all may leave together, so
   * that they never leave more than that between them.
   */
  maxBufferedBytes(): number {
    return Math.min(MOST_UNREAD_BYTES, this.unreadBytesInAll / Math.max(1, this.#connections));
  }

  /**
   * Takes a join from the address's joins, and one of its new groups for this hour for a group
   * the server does not know, if both have one left.
   */
  allowsJoin(address: string, known: boolean, now: number): boolean {
    if (!this.#joinBuckets.has(address, now)) return false;
    if (!known && !this.#newGroupBuckets.has(address, now)) return false;
    this.#joinBuckets.take(address, now);
    if (!known) this.#newGroupBuckets.take(address, now);
    return true;
  }
}
