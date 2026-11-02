// The internet transport (docs/protocol.md §8): stores pushed envelopes and fans them out to the
// other connections of the same group. One connection carries one group. Limits on connections,
// new groups and pushes are kept by relay-limits.ts; pushes are also refused while the disk is
// nearly full.

import type { TokenBucket } from '@tesel/core';
import {
  encodeRelayMessage,
  parseClientMessage,
  toBase64url,
  type ServerMessage,
} from '@tesel/protocol';
import WebSocket from 'ws';

import type { AppendResult, EnvelopeStore, StoredEnvelope } from './envelope-store.ts';
import { DEFAULT_LIMITS, Limiter, type RelayLimits } from './relay-limits.ts';
import { frameText } from './ws-text.ts';

export interface RelayOptions {
  readonly limits?: RelayLimits;
  readonly now?: () => number;
  /** Whether there is disk space for more envelopes; pushes are refused while there is not. */
  readonly hasRoom?: () => boolean;
}

/**
 * Backlog envelopes read from the database and sent at a time. Each page goes once the previous
 * one has left, and live envelopes are rate-limited, so a client that reads stays well within
 * what it may leave unread (relay-limits.ts).
 */
const BACKLOG_PAGE = 500;

/** WebSocket close codes (RFC 6455 §7.4.1). */
const CLOSE_POLICY_VIOLATION = 1008;
const CLOSE_INTERNAL_ERROR = 1011;
const CLOSE_TRY_AGAIN_LATER = 1013;

interface GroupRoom {
  /** Connections that receive envelopes as they are stored. */
  readonly live: Set<WebSocket>;
  /** Connections still receiving their backlog, which ends with whatever is stored meanwhile. */
  readonly catchingUp: Set<WebSocket>;
}

/** One client connection and what the relay knows about it. */
interface Connection {
  readonly socket: WebSocket;
  readonly address: string;
  readonly bucket: TokenBucket;
  readonly joinTimer: ReturnType<typeof setTimeout>;
  group: Uint8Array | null;
}

export class Relay {
  readonly #store: EnvelopeStore;
  readonly #now: () => number;
  readonly #hasRoom: () => boolean;
  readonly #limiter: Limiter;
  readonly #rooms = new Map<string, GroupRoom>();

  constructor(store: EnvelopeStore, options: RelayOptions = {}) {
    this.#store = store;
    this.#now = options.now ?? Date.now;
    this.#hasRoom = options.hasRoom ?? (() => true);
    this.#limiter = new Limiter(options.limits ?? DEFAULT_LIMITS, this.#now());
  }

  /** Whether one more connection from `address` is within the limits. */
  admits(address: string): boolean {
    return this.#limiter.admits(address);
  }

  /** Serves a client connection from `address`, which `admits` has let in. */
  accept(socket: WebSocket, address: string): void {
    this.#limiter.opened(address);
    const connection: Connection = {
      socket,
      address,
      bucket: this.#limiter.connectionBucket(this.#now()),
      joinTimer: setTimeout(() => {
        socket.close(CLOSE_POLICY_VIOLATION, 'No join');
      }, this.#limiter.joinTimeoutMs),
      group: null,
    };

    socket.on('message', (data, isBinary) => {
      try {
        this.#receive(connection, isBinary ? null : frameText(data));
      } catch (error) {
        console.error('The relay could not handle a message:', error);
        socket.close(CLOSE_INTERNAL_ERROR);
      }
    });

    socket.on('close', () => {
      clearTimeout(connection.joinTimer);
      this.#limiter.closed(address);
      if (connection.group !== null) this.#leave(socket, connection.group);
    });
  }

  /** Handles a frame's text, or null for a binary frame, which the protocol never uses. */
  #receive(connection: Connection, text: string | null): void {
    const { socket } = connection;
    const parsed =
      text === null
        ? ({ ok: false, error: { code: 'bad-request', key: null } } as const)
        : parseClientMessage(text);
    if (!parsed.ok) {
      this.#send(socket, { t: 'error', code: parsed.error.code, key: parsed.error.key });
      return;
    }
    const message = parsed.value;
    switch (message.t) {
      case 'join':
        if (connection.group !== null) {
          this.#send(socket, { t: 'error', code: 'bad-request', key: null });
          return;
        }
        if (!this.#mayJoin(message.group, connection.address)) {
          this.#send(socket, { t: 'error', code: 'rate-limited', key: null });
          socket.close(CLOSE_TRY_AGAIN_LATER, 'Too many new groups');
          return;
        }
        clearTimeout(connection.joinTimer);
        connection.group = message.group;
        this.#join(socket, message.group, message.after);
        return;
      case 'push':
        if (connection.group === null) {
          this.#send(socket, { t: 'error', code: 'not-joined', key: message.key });
          return;
        }
        this.#push(connection, connection.group, message.key, message.env);
        return;
      case 'ping':
        this.#send(socket, { t: 'pong' });
        return;
    }
  }

  /** A group the server knows can always be joined; others count against the address. */
  #mayJoin(group: Uint8Array, address: string): boolean {
    const known = this.#rooms.has(toBase64url(group)) || this.#store.lastCursor(group) > 0;
    return known || this.#limiter.mayOpenGroup(address, this.#now());
  }

  #push(connection: Connection, group: Uint8Array, key: Uint8Array, env: Uint8Array): void {
    const { socket, bucket, address } = connection;
    if (!this.#limiter.allowsPush(bucket, toBase64url(group), address, this.#now())) {
      this.#send(socket, { t: 'error', code: 'rate-limited', key });
      return;
    }
    if (!this.#hasRoom()) {
      this.#send(socket, { t: 'error', code: 'unavailable', key });
      return;
    }
    let stored: AppendResult;
    try {
      stored = this.#store.append(group, key, env, this.#now());
    } catch (error) {
      console.error('An envelope could not be stored:', error);
      this.#send(socket, { t: 'error', code: 'unavailable', key });
      return;
    }
    this.#send(socket, { t: 'stored', key });
    if (!stored.isNew) return;
    // Relayed to the group's live clients but its sender, encoded once for all of them.
    const frame = encodeRelayMessage({ t: 'env', cursor: stored.cursor, key, env });
    for (const other of this.#rooms.get(toBase64url(group))?.live ?? []) {
      if (other !== socket) this.#sendFrame(other, frame);
    }
  }

  #join(socket: WebSocket, group: Uint8Array, after: number): void {
    const id = toBase64url(group);
    let room = this.#rooms.get(id);
    if (room === undefined) {
      room = { live: new Set(), catchingUp: new Set() };
      this.#rooms.set(id, room);
    }
    room.catchingUp.add(socket);
    void this.#catchUp(socket, group, after, room);
  }

  /**
   * Sends the backlog page by page, each once the previous one has left, so a long backlog
   * neither holds up the server nor piles up in memory. The last page, `synced` and the move to
   * the live clients happen together, with nothing in between: an envelope stored before them
   * is in the last page, and one stored after them is sent live. None is lost or sent twice.
   */
  async #catchUp(
    socket: WebSocket,
    group: Uint8Array,
    after: number,
    room: GroupRoom,
  ): Promise<void> {
    try {
      // A cursor beyond the last one comes from before a data loss: the client gets everything
      // there is and adopts the store's cursor (protocol §8).
      let cursor = after > this.#store.lastCursor(group) ? 0 : after;
      for (;;) {
        const page = this.#store.after(group, cursor, BACKLOG_PAGE);
        if (page.length < BACKLOG_PAGE) {
          for (const stored of page) this.#send(socket, envMessage(stored));
          const last = this.#store.lastCursor(group);
          this.#send(socket, { t: 'synced', cursor: last, store: this.#store.id });
          room.catchingUp.delete(socket);
          room.live.add(socket);
          return;
        }
        await sendPage(socket, page.map(envMessage));
        if (!room.catchingUp.has(socket)) return;
        cursor = page.at(-1)?.cursor ?? cursor;
      }
    } catch (error) {
      console.error('A backlog could not be read:', error);
      socket.close(CLOSE_INTERNAL_ERROR);
    }
  }

  #leave(socket: WebSocket, group: Uint8Array): void {
    const id = toBase64url(group);
    const room = this.#rooms.get(id);
    room?.live.delete(socket);
    room?.catchingUp.delete(socket);
    if (room?.live.size === 0 && room.catchingUp.size === 0) this.#rooms.delete(id);
  }

  /** Sends a message, and drops a client that has stopped reading. */
  #send(socket: WebSocket, message: ServerMessage): void {
    this.#sendFrame(socket, encodeRelayMessage(message));
  }

  /** Sends an encoded message, and drops a client that has stopped reading. */
  #sendFrame(socket: WebSocket, frame: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(frame);
    if (socket.bufferedAmount > this.#limiter.maxBufferedBytes()) socket.terminate();
  }
}

function envMessage(stored: StoredEnvelope): ServerMessage {
  return { t: 'env', cursor: stored.cursor, key: stored.key, env: stored.env };
}

/** Sends messages; resolves once the last has been handed to the system, or the socket closed. */
function sendPage(socket: WebSocket, messages: readonly ServerMessage[]): Promise<void> {
  return new Promise((resolve) => {
    if (socket.readyState !== WebSocket.OPEN) {
      resolve();
      return;
    }
    const last = messages.length - 1;
    messages.forEach((message, index) => {
      if (index < last) {
        socket.send(encodeRelayMessage(message));
        return;
      }
      socket.send(encodeRelayMessage(message), () => {
        resolve();
      });
    });
  });
}
