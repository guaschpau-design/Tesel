// The internet transport (docs/protocol.md §8): stores pushed envelopes and fans them out to the
// other connections of the same group. One connection carries one group. Backlogs go out through
// backlog.ts; limits on connections, joins and messages are relay-limits.ts's, those on pushes
// push-limits.ts's. Pushes are also refused while the disk is nearly full.

import {
  encodeRelayMessage,
  parseClientMessage,
  toBase64url,
  type RelayErrorCode,
  type ServerMessage,
} from '@tesel/protocol';
import WebSocket from 'ws';

import { Backlogs } from './backlog.ts';
import type { AppendResult, EnvelopeStore } from './envelope-store.ts';
import { PushLimiter, type Pusher } from './push-limits.ts';
import {
  DEFAULT_LIMITS,
  Limiter,
  type ConnectionBudget,
  type RelayLimits,
} from './relay-limits.ts';
import { UnreadBytes } from './unread-bytes.ts';
import { frameText } from './ws-text.ts';

export interface RelayOptions {
  readonly limits?: RelayLimits;
  readonly now?: () => number;
  /** Whether there is disk space for more envelopes; pushes are refused while there is not. */
  readonly hasRoom?: () => boolean;
}

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

/** The group a connection joined, and how it pushes there. */
interface Joined {
  readonly group: Uint8Array;
  readonly pusher: Pusher;
}

/** One client connection and what the relay knows about it. */
interface Connection {
  readonly socket: WebSocket;
  readonly address: string;
  readonly budget: ConnectionBudget;
  readonly joinTimer: ReturnType<typeof setTimeout>;
  /** Null until it joins. */
  joined: Joined | null;
}

export class Relay {
  readonly #store: EnvelopeStore;
  readonly #now: () => number;
  readonly #hasRoom: () => boolean;
  readonly #limiter: Limiter;
  readonly #pushes: PushLimiter;
  readonly #backlogs: Backlogs;
  readonly #unread: UnreadBytes;
  readonly #rooms = new Map<string, GroupRoom>();
  readonly #sockets = new Set<WebSocket>();

  constructor(store: EnvelopeStore, options: RelayOptions = {}) {
    const limits = options.limits ?? DEFAULT_LIMITS;
    this.#store = store;
    this.#now = options.now ?? Date.now;
    this.#hasRoom = options.hasRoom ?? (() => true);
    this.#limiter = new Limiter(limits);
    this.#pushes = new PushLimiter(limits, this.#now());
    this.#backlogs = new Backlogs(store, () => this.#limiter.maxBufferedBytes());
    this.#unread = new UnreadBytes(this.#limiter.unreadBytesInAll);
  }

  /** Whether one more connection from `address` is within the limits. */
  admits(address: string): boolean {
    return this.#limiter.admits(address);
  }

  /** Serves a client connection from `address`, which `admits` has let in. */
  accept(socket: WebSocket, address: string): void {
    this.#sockets.add(socket);
    const connection: Connection = {
      socket,
      address,
      budget: this.#limiter.opened(address, this.#now()),
      joinTimer: setTimeout(() => {
        socket.close(CLOSE_POLICY_VIOLATION, 'No join');
      }, this.#limiter.joinTimeoutMs),
      joined: null,
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
      this.#sockets.delete(socket);
      this.#limiter.closed(address);
      if (connection.joined !== null) this.#leave(socket, connection.joined.pusher.group);
    });
  }

  /** Handles a frame's text, or null for a binary frame, which the protocol never uses. */
  #receive(connection: Connection, text: string | null): void {
    const { socket, address, budget } = connection;
    const now = this.#now();
    if (!budget.messages.take(now)) {
      socket.close(CLOSE_POLICY_VIOLATION, 'Too many messages');
      return;
    }
    const parsed =
      text === null
        ? ({ ok: false, error: { code: 'bad-request', key: null } } as const)
        : parseClientMessage(text);
    if (!parsed.ok) {
      this.#refuse(connection, parsed.error.code, parsed.error.key);
      return;
    }
    const message = parsed.value;
    switch (message.t) {
      case 'join':
        if (connection.joined !== null) {
          this.#refuse(connection, 'bad-request', null);
          return;
        }
        if (!this.#limiter.allowsJoin(address, this.#knows(message.group), now)) {
          this.#send(socket, { t: 'error', code: 'rate-limited', key: null });
          socket.close(CLOSE_TRY_AGAIN_LATER, 'Too many joins or new groups');
          return;
        }
        clearTimeout(connection.joinTimer);
        this.#join(connection, message.group, message.after, now);
        return;
      case 'push':
        if (connection.joined === null) {
          this.#refuse(connection, 'not-joined', message.key);
          return;
        }
        this.#push(socket, connection.joined, message.key, message.env);
        return;
      case 'ping':
        this.#send(socket, { t: 'pong' });
        return;
    }
  }

  /** Answers a message the relay cannot take, and closes a connection that keeps sending them. */
  #refuse(connection: Connection, code: RelayErrorCode, key: Uint8Array | null): void {
    if (!connection.budget.refused.take(this.#now())) {
      connection.socket.close(CLOSE_POLICY_VIOLATION, 'Too many bad messages');
      return;
    }
    this.#send(connection.socket, { t: 'error', code, key });
  }

  /** Whether the server knows the group: a client is in it, or it has envelopes. */
  #knows(group: Uint8Array): boolean {
    return this.#rooms.has(toBase64url(group)) || this.#store.lastCursor(group) > 0;
  }

  #push(socket: WebSocket, joined: Joined, key: Uint8Array, env: Uint8Array): void {
    const { group, pusher } = joined;
    const now = this.#now();
    if (!this.#pushes.allows(pusher, env.length, now)) {
      this.#send(socket, { t: 'error', code: 'rate-limited', key });
      return;
    }
    if (!this.#hasRoom()) {
      this.#send(socket, { t: 'error', code: 'unavailable', key });
      return;
    }
    let stored: AppendResult;
    try {
      stored = this.#store.append(group, key, env, now);
    } catch (error) {
      console.error('An envelope could not be stored:', error);
      this.#send(socket, { t: 'error', code: 'unavailable', key });
      return;
    }
    this.#send(socket, { t: 'stored', key });
    if (!stored.isNew) return;
    this.#pushes.stored(pusher, env.length, now);
    // Relayed to the group's live clients but its sender, encoded once for all of them.
    const frame = encodeRelayMessage({ t: 'env', cursor: stored.cursor, key, env });
    for (const other of this.#rooms.get(pusher.group)?.live ?? []) {
      if (other !== socket) this.#sendFrame(other, frame);
    }
  }

  #join(connection: Connection, group: Uint8Array, after: number, now: number): void {
    const { socket, address } = connection;
    const id = toBase64url(group);
    connection.joined = {
      group,
      pusher: {
        bucket: this.#pushes.connectionBucket(now),
        address,
        group: id,
        groupSince: this.#store.firstReceivedAt(group) ?? now,
      },
    };
    let room = this.#rooms.get(id);
    if (room === undefined) {
      room = { live: new Set(), catchingUp: new Set() };
      this.#rooms.set(id, room);
    }
    const { live, catchingUp } = room;
    catchingUp.add(socket);
    this.#backlogs
      .send({
        socket,
        group,
        after,
        send: (frame) => {
          this.#sendFrame(socket, frame);
        },
        waiting: () => catchingUp.has(socket),
        caughtUp: () => {
          catchingUp.delete(socket);
          live.add(socket);
        },
      })
      .catch((error: unknown) => {
        console.error('A backlog could not be read:', error);
        socket.close(CLOSE_INTERNAL_ERROR);
      });
  }

  #leave(socket: WebSocket, id: string): void {
    const room = this.#rooms.get(id);
    room?.live.delete(socket);
    room?.catchingUp.delete(socket);
    if (room?.live.size === 0 && room.catchingUp.size === 0) this.#rooms.delete(id);
  }

  /** Sends a message, and drops a client that has stopped reading. */
  #send(socket: WebSocket, message: ServerMessage): void {
    this.#sendFrame(socket, encodeRelayMessage(message));
  }

  /**
   * Sends an encoded message. Drops a client that has left more unread than its part, and those
   * that left the most while all together are over what they may leave.
   */
  #sendFrame(socket: WebSocket, frame: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(frame);
    if (socket.bufferedAmount > this.#limiter.maxBufferedBytes()) socket.terminate();
    this.#unread.check(this.#sockets, this.#now());
  }
}
