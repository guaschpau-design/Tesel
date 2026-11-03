// The backlog of a joining client (protocol §8): the envelopes after its cursor, sent ahead of the
// live ones. It goes a page at a time, no larger than what the client may still leave unread,
// and the next page waits until the previous one has left the server's buffers, so a client that
// reads slowly holds about one page in the server's memory. Between pages the event loop goes
// round, and only a few backlogs prepare a page in each round, so however many clients join with
// however long backlogs, timers and other clients are served in between.

import { setImmediate as nextRound, setTimeout as sleep } from 'node:timers/promises';

import { encodeRelayMessage } from '@tesel/protocol';
import WebSocket from 'ws';

import type { EnvelopeStore } from './envelope-store.ts';

/** Envelopes read from the database at a time: a few milliseconds of work at most. */
const PAGE_ENVELOPES = 250;
/** Backlogs that may prepare a page in one round of the event loop; the others wait their turn. */
const PAGES_PER_ROUND = 4;
/** How often a backlog waiting for its last page to leave looks again. */
const DRAIN_POLL_MS = 20;
/** What a WebSocket frame adds to its message, at most: its header. */
const FRAME_HEADER_BYTES = 10;

/** A client waiting for its backlog, and what the relay does with what is read for it. */
export interface BacklogClient {
  readonly socket: WebSocket;
  readonly group: Uint8Array;
  /** The cursor it joined with. */
  readonly after: number;
  /** Sends one frame, dropping a client that leaves too much unread. */
  readonly send: (frame: string) => void;
  /** Whether it still waits for its backlog: it has not left. */
  readonly waiting: () => boolean;
  /** Runs right after `synced` is sent, in the same turn: the client then takes live envelopes. */
  readonly caughtUp: () => void;
}

export class Backlogs {
  readonly #store: EnvelopeStore;
  readonly #maxBufferedBytes: () => number;
  readonly #turns = new Turns();

  /** `maxBufferedBytes` tells what one connection may leave unread now. */
  constructor(store: EnvelopeStore, maxBufferedBytes: () => number) {
    this.#store = store;
    this.#maxBufferedBytes = maxBufferedBytes;
  }

  /**
   * Sends the client its backlog, then `synced`. The last page, `synced` and `caughtUp` happen
   * together, with nothing in between: an envelope stored before them is in the last page, and
   * one stored after them is sent live. None is lost or sent twice. Rejects if the database
   * cannot be read.
   */
  async send(client: BacklogClient): Promise<void> {
    // A cursor beyond the last one comes from before a data loss: the client gets everything
    // there is and adopts the store's cursor (protocol §8).
    let cursor = client.after > this.#store.lastCursor(client.group) ? 0 : client.after;
    for (;;) {
      await this.#turns.take();
      let reached: number | null;
      try {
        if (client.socket.readyState !== WebSocket.OPEN || !client.waiting()) return;
        reached = this.#sendPage(client, cursor);
      } finally {
        this.#turns.giveBack();
      }
      if (reached === null) return;
      cursor = reached;
      await drained(client.socket);
    }
  }

  /**
   * Sends what fits of the page after `cursor`, and at the end of the backlog `synced` too.
   * Returns the cursor of the last envelope sent, or null once the client has caught up.
   */
  #sendPage(client: BacklogClient, cursor: number): number | null {
    const room = this.#maxBufferedBytes() - client.socket.bufferedAmount;
    const page = this.#store.after(client.group, cursor, PAGE_ENVELOPES);
    let reached = cursor;
    let sent = 0;
    let bytes = 0;
    for (const stored of page) {
      const frame = encodeRelayMessage({ t: 'env', ...stored });
      const frameBytes = frame.length + FRAME_HEADER_BYTES;
      // At least one goes, so a backlog moves on however little room there is.
      if (sent > 0 && bytes + frameBytes > room) break;
      client.send(frame);
      reached = stored.cursor;
      sent += 1;
      bytes += frameBytes;
    }
    if (sent < page.length || page.length === PAGE_ENVELOPES) return reached;
    const last = this.#store.lastCursor(client.group);
    client.send(encodeRelayMessage({ t: 'synced', cursor: last, store: this.#store.id }));
    client.caughtUp();
    return null;
  }
}

/** Turns at preparing a page: PAGES_PER_ROUND in each round of the event loop, in the order asked. */
class Turns {
  #free = PAGES_PER_ROUND;
  readonly #waiting: (() => void)[] = [];

  take(): Promise<void> {
    if (this.#free > 0) {
      this.#free -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#waiting.push(resolve));
  }

  /** Gives the turn back once the event loop has gone round, so other work runs in between. */
  giveBack(): void {
    setImmediate(() => {
      const next = this.#waiting.shift();
      if (next === undefined) this.#free += 1;
      else next();
    });
  }
}

/** Resolves once the event loop has gone round and the socket's buffer is empty, or it closed. */
async function drained(socket: WebSocket): Promise<void> {
  await nextRound();
  while (socket.readyState === WebSocket.OPEN && socket.bufferedAmount > 0) {
    await sleep(DRAIN_POLL_MS);
  }
}
