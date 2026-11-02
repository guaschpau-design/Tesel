// Keeps one group's WebSocket to its server open (protocol §8): joins with the last cursor, passes
// envelopes on in order, in batches, and reconnects with back-off when the link drops. An SOS, its
// cancellation or an acknowledgement goes as soon as the device has joined, ahead of the backlog;
// a backlog stored slower than it arrives, or not at all, is read again later rather than piled up
// or lost (ADR-0103).

import { isLifeSafety } from '@tesel/core';
import {
  encodeRelayMessage,
  parseServerMessage,
  relayUrl,
  type EventType,
  type RelayErrorCode,
  type ServerMessage,
} from '@tesel/protocol';

import { PushQueue } from './push-queue.ts';
import { RelayHeartbeat } from './relay-heartbeat.ts';
import type {
  Link,
  ReceivedEnvelope,
  RelayClientOptions,
  RelayStatus,
  SocketLike,
} from './relay-types.ts';

/** Refusals of a push that will do for another try a little later. */
const TRY_LATER: ReadonlySet<RelayErrorCode> = new Set(['rate-limited', 'unavailable']);

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/** A connection that has not opened by then is given up, and tried again later. */
const CONNECT_TIMEOUT_MS = 5000;
/** Largest batch of envelopes handed on at once, so that no single step blocks the app for long. */
const MAX_BATCH = 1000;
/**
 * Batches that may wait to be handed on. Beyond them the link takes no more envelopes and is
 * joined again once they are in, so a backlog stored slower than it arrives does not pile up in
 * memory: the browser's WebSocket cannot be asked to read more slowly.
 */
const MAX_WAITING_BATCHES = 4;

export class RelayClient {
  readonly #options: RelayClientOptions;
  readonly #createSocket: (url: string) => SocketLike;
  readonly #random: () => number;
  #socket: SocketLike | null = null;
  #status: RelayStatus = 'disconnected';
  #retryMs = FIRST_RETRY_MS;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #connectTimer: ReturnType<typeof setTimeout> | null = null;
  readonly #heartbeat = new RelayHeartbeat();
  #stopped = true;
  /**
   * Messages are handled one at a time, in arrival order, so cursors only move forward. If one
   * fails, the rest of that link's messages are dropped and the link closed: joining again from
   * the last stored cursor brings back what was lost, instead of a later cursor skipping it. A
   * batch of envelopes that cannot be taken leaves the link open for pushes (`#handOn`).
   */
  #queue: Promise<void> = Promise.resolve();
  /** The batch envelopes join while it waits in the queue; null once it starts or is closed. */
  #batch: ReceivedEnvelope[] | null = null;
  readonly #pushes = new PushQueue((key, env) => {
    this.#socket?.send(encodeRelayMessage({ t: 'push', key, env }));
  });

  constructor(options: RelayClientOptions) {
    this.#options = options;
    this.#createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.#random = options.random ?? Math.random;
  }

  get status(): RelayStatus {
    return this.#status;
  }

  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    this.#pushes.clear();
    this.#clearTimers();
    if (this.#socket !== null) this.#drop(this.#socket);
    this.#setStatus('disconnected');
  }

  /** Reconnects now if the link is down, for instance when the browser comes back online. */
  retryNow(): void {
    if (this.#stopped || this.#socket !== null || this.#retryTimer === null) return;
    this.#clearTimers();
    this.#connect();
  }

  /**
   * Queues an envelope for the relay, most urgent first. Returns false if the link does not take
   * it yet: an SOS, a cancellation or an acknowledgement goes once joined, the rest once synced.
   * The caller keeps it in its outbox and offers it again after the next sync.
   */
  push(key: Uint8Array, env: Uint8Array, type: EventType | null): boolean {
    const takes = this.#status === 'synced' || (this.#status === 'syncing' && isLifeSafety(type));
    if (!takes || this.#socket === null) return false;
    this.#pushes.add(key, env, type);
    return true;
  }

  #connect(): void {
    this.#setStatus('connecting');
    const socket = this.#createSocket(relayUrl(this.#options.server));
    const link: Link = { socket, store: null, waiting: 0, taking: true, failed: false };
    this.#socket = socket;
    this.#batch = null;
    this.#connectTimer = setTimeout(() => {
      this.#connectTimer = null;
      if (this.#drop(socket)) this.#lost();
    }, CONNECT_TIMEOUT_MS);
    socket.onopen = () => {
      this.#clearConnectTimer();
      this.#heard(socket);
      this.#enqueue(socket, async () => {
        const position = await this.#options.handlers.position();
        if (this.#socket !== socket) return;
        link.store = position.store;
        const join = { t: 'join', group: this.#options.group, after: position.cursor } as const;
        socket.send(encodeRelayMessage(join));
        this.#setStatus('syncing');
        await this.#options.handlers.onJoined();
      });
    };
    socket.onmessage = (event) => {
      this.#heard(socket);
      const message = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
      if (message === null || message.t === 'pong') return;
      if (message.t === 'env') {
        const { key, env, cursor } = message;
        this.#collect(link, { key, env, cursor });
        return;
      }
      // Envelopes after this message go in a new batch, handled after it.
      this.#batch = null;
      this.#enqueue(socket, () => this.#handle(message, link));
    };
    socket.onclose = () => {
      if (this.#drop(socket)) this.#lost();
    };
  }

  #heard(socket: SocketLike): void {
    this.#heartbeat.heard(socket, () => {
      if (this.#drop(socket)) this.#lost();
    });
  }

  /** Joins again at once, from the position the handlers now give. */
  #rejoin(socket: SocketLike): void {
    if (!this.#drop(socket)) return;
    this.#pushes.clear();
    this.#connect();
  }

  /**
   * Lets go of a link: it is closed and no longer the one in use, and its timers stop. Returns
   * false if it already was let go, so whatever let go of it first decides what comes next.
   */
  #drop(socket: SocketLike): boolean {
    if (this.#socket !== socket) return false;
    this.#socket = null;
    this.#clearConnectTimer();
    this.#heartbeat.stop();
    socket.close();
    return true;
  }

  /** The link is gone: it is tried again after a wait that grows while it keeps failing. */
  #lost(): void {
    this.#pushes.clear();
    if (this.#stopped) return;
    this.#setStatus('disconnected');
    this.#scheduleRetry(() => {
      this.#connect();
    });
  }

  /**
   * Adds an envelope to the waiting batch, or queues a new batch if none is waiting or it is full.
   * With too many batches waiting, the link takes no more and joins again once they are in.
   */
  #collect(link: Link, envelope: ReceivedEnvelope): void {
    if (!link.taking) return;
    if (this.#batch === null || this.#batch.length >= MAX_BATCH) {
      if (link.waiting >= MAX_WAITING_BATCHES) {
        link.taking = false;
        this.#batch = null;
        this.#enqueue(link.socket, () => {
          if (!link.failed) this.#rejoin(link.socket);
          return Promise.resolve();
        });
        return;
      }
      const batch: ReceivedEnvelope[] = [];
      this.#batch = batch;
      link.waiting++;
      this.#enqueue(link.socket, () => this.#handOn(link, batch));
    }
    this.#batch.push(envelope);
  }

  /**
   * Hands a batch on. If that fails, as with a full storage, the link takes no more envelopes, so
   * the cursor stays behind the batch, and is joined again after the usual wait to read it again.
   * Until then it still pushes, and reaches `synced` so the whole outbox goes.
   */
  async #handOn(link: Link, batch: readonly ReceivedEnvelope[]): Promise<void> {
    link.waiting--;
    if (this.#batch === batch) this.#batch = null;
    if (link.failed) return;
    try {
      await this.#options.handlers.onEnvelopes(batch, link.store);
    } catch (error) {
      console.warn('Relay envelopes could not be taken', error);
      link.taking = false;
      link.failed = true;
      this.#scheduleRetry(() => {
        this.#rejoin(link.socket);
      });
    }
  }

  async #handle(message: Exclude<ServerMessage, { t: 'env' | 'pong' }>, link: Link): Promise<void> {
    const { handlers } = this.#options;
    switch (message.t) {
      case 'synced':
        if (link.store !== null && link.store !== message.store) {
          await handlers.onStoreChanged(message.store);
          this.#rejoin(link.socket);
          return;
        }
        if (!link.failed) this.#retryMs = FIRST_RETRY_MS;
        this.#setStatus('synced');
        await handlers.onSynced(
          link.taking ? { cursor: message.cursor, store: message.store } : null,
        );
        return;
      case 'stored': {
        const env = this.#pushes.stored(message.key);
        if (env !== null) await handlers.onStored(message.key, env);
        return;
      }
      case 'error':
        if (TRY_LATER.has(message.code) && message.key !== null) {
          this.#pushes.tryLater(message.key);
          return;
        }
        // Anything else refused stays in the outbox and goes again after the next sync.
        console.warn('Relay refused a message', message.code);
        return;
    }
  }

  /** Queues the handling of a message of `socket`; it is skipped once that link is gone. */
  #enqueue(socket: SocketLike, task: () => Promise<void>): void {
    this.#queue = this.#queue
      .then(() => (this.#socket === socket ? task() : undefined))
      .catch((error: unknown) => {
        console.warn('Relay message handling failed', error);
        if (this.#drop(socket)) this.#lost();
      });
  }

  /** Runs `next` after a wait that grows each time, with jitter. */
  #scheduleRetry(next: () => void): void {
    if (this.#stopped) return;
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    // Jitter spreads reconnections when a server comes back with many clients waiting.
    const delay = this.#retryMs * (0.5 + this.#random());
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      next();
    }, delay);
  }

  #clearTimers(): void {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    this.#clearConnectTimer();
    this.#heartbeat.stop();
  }

  #clearConnectTimer(): void {
    if (this.#connectTimer !== null) clearTimeout(this.#connectTimer);
    this.#connectTimer = null;
  }

  #setStatus(status: RelayStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    this.#options.handlers.onStatus(status);
  }
}
