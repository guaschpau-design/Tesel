// Liveness of the relay's WebSocket connections: a connection whose peer vanished without closing
// it (a phone out of coverage, a broken route) would otherwise stay open for many minutes.

import { randomBytes } from 'node:crypto';

import type WebSocket from 'ws';

/** Connections that do not answer a ping within this time are closed. */
const HEARTBEAT_MS = 30_000;
/** Bytes of the random payload each ping carries, which its answer must echo. */
const PING_BYTES = 8;

/**
 * Pings every watched socket on each beat and terminates those that missed the previous ping.
 * Only a pong that echoes the socket's last ping counts: a client may send pongs of its own at any
 * time (RFC 6455 §5.5.3), and one that had stopped reading could otherwise stay open with them.
 */
export class Heartbeat {
  /** Each socket's last ping payload, or null once it has been answered. */
  readonly #waiting = new Map<WebSocket, Buffer | null>();
  readonly #timer: ReturnType<typeof setInterval>;

  constructor(intervalMs: number = HEARTBEAT_MS) {
    this.#timer = setInterval(() => {
      this.#beat();
    }, intervalMs);
  }

  /** Watches an open socket until it closes. */
  watch(socket: WebSocket): void {
    this.#waiting.set(socket, null);
    socket.on('pong', (data: Buffer) => {
      const ping = this.#waiting.get(socket);
      if (ping?.equals(data)) this.#waiting.set(socket, null);
    });
    socket.once('close', () => this.#waiting.delete(socket));
  }

  stop(): void {
    clearInterval(this.#timer);
  }

  #beat(): void {
    for (const [socket, ping] of this.#waiting) {
      if (ping !== null) {
        socket.terminate();
        continue;
      }
      const next = randomBytes(PING_BYTES);
      this.#waiting.set(socket, next);
      socket.ping(next);
    }
  }
}
