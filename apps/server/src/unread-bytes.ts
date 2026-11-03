// What all clients together have left unread, kept under a cap. Each connection may leave only
// its part of the cap (relay-limits.ts), but the parts shrink as clients connect, after some
// have already filled theirs. So as frames go out, at most once a second, the relay adds up what
// every connection has left, and if together they are over the cap, closes those that left the
// most until the rest are under it.

import type WebSocket from 'ws';

/** What it needs of a connection's socket. */
type Unread = Pick<WebSocket, 'bufferedAmount' | 'terminate'>;

/** How often the total is added up, at most. */
const CHECK_EVERY_MS = 1000;

export class UnreadBytes {
  readonly #cap: number;
  #checkedAt = -Infinity;

  /** `cap` is what all clients may leave unread together, in bytes. */
  constructor(cap: number) {
    this.#cap = cap;
  }

  /** Closes the clients that left the most unread while all together are over the cap. */
  check(sockets: Iterable<Unread>, now: number): void {
    if (now - this.#checkedAt < CHECK_EVERY_MS) return;
    this.#checkedAt = now;
    let total = 0;
    const unread: Unread[] = [];
    for (const socket of sockets) {
      if (socket.bufferedAmount === 0) continue;
      total += socket.bufferedAmount;
      unread.push(socket);
    }
    if (total <= this.#cap) return;
    unread.sort((a, b) => b.bufferedAmount - a.bufferedAmount);
    for (const socket of unread) {
      if (total <= this.#cap) return;
      total -= socket.bufferedAmount;
      socket.terminate();
    }
  }
}
