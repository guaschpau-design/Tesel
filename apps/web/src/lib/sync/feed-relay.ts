// A group feed's side of its group's server (protocol §8): keeps the relay client going while the
// browser comes and goes, opens the envelopes it brings and hands their events to the feed, seals
// and pushes the outbox, and confirms each event once the server has stored it.

import {
  bytesEqual,
  eventKey,
  openEnvelope,
  peekHeader,
  sealEnvelope,
  toBase64url,
  type GroupKeys,
  type NodeId,
} from '@tesel/protocol';

import {
  confirmStored,
  pendingEvents,
  requeueOwnEvents,
  type ServerRead,
} from '../events/event-log.ts';
import type { AppDb, GroupEventRef } from '../storage/app-db.ts';
import { loadPosition, savePosition } from './cursor-store.ts';
import { peekType } from './lora-events.ts';
import { RelayClient } from './relay-client.ts';
import type { ReceivedEnvelope, RelayStatus, SocketLike } from './relay-types.ts';
import { checkServerClock } from './server-clock.ts';

interface FeedRelayOptions {
  readonly db: AppDb;
  /** The group on this device. */
  readonly groupId: string;
  /** The group's server, by its base URL. */
  readonly server: string;
  readonly keys: GroupKeys;
  /** This device, whose events are offered again to a server that lost them. */
  readonly self: NodeId;
  /** Stands in for the WebSocket in tests. */
  readonly createSocket: ((url: string) => SocketLike) | undefined;
  /** The events of a batch of envelopes: those sealed with the group's key, under their own key. */
  readonly onEvents: (events: Uint8Array[], readTo: ServerRead) => Promise<void>;
  /** An outbox entry the server has stored, just before it leaves the outbox. */
  readonly onStored: (entry: GroupEventRef) => void;
  readonly onStatus: (status: RelayStatus) => void;
}

export class FeedRelay {
  readonly #db: AppDb;
  readonly #groupId: string;
  readonly #keys: GroupKeys;
  readonly #onEvents: FeedRelayOptions['onEvents'];
  readonly #onStored: FeedRelayOptions['onStored'];
  readonly #client: RelayClient;
  /**
   * Outbox entries pushed on this connection, by event key, with their envelopes the server has
   * not stored yet: more than one under a key that has rivals (protocol §3.1). The entry leaves
   * the outbox once every one is stored.
   */
  readonly #pushed = new Map<string, { entry: GroupEventRef; waiting: Set<string> }>();
  readonly #retry = () => {
    this.#client.retryNow();
  };

  constructor(options: FeedRelayOptions) {
    const { db, groupId, server, keys, self, createSocket, onStatus } = options;
    this.#db = db;
    this.#groupId = groupId;
    this.#keys = keys;
    this.#onEvents = options.onEvents;
    this.#onStored = options.onStored;
    this.#client = new RelayClient({
      server,
      group: keys.groupId,
      ...(createSocket ? { createSocket } : {}),
      handlers: {
        position: () => loadPosition(db, groupId, server),
        // What the outbox holds of SOS calls, cancellations and acknowledgements goes at once.
        onJoined: () => this.#flushOutbox(),
        onEnvelopes: (batch, store) => this.#receive(batch, server, store),
        onSynced: async (position) => {
          if (position !== null) await savePosition(db, groupId, server, position);
          await this.#flushOutbox();
        },
        onStoreChanged: async (store) => {
          await savePosition(db, groupId, server, { cursor: 0, store });
          await requeueOwnEvents(db, groupId, self);
        },
        onStored: (key, env) => this.#confirm(key, env),
        onStatus: (status) => {
          onStatus(status);
          if (status !== 'connecting') return;
          // What a link that is gone pushed goes again from the outbox on the next.
          this.#pushed.clear();
          // Each try to connect checks this device's clock against the server's.
          void checkServerClock(server);
        },
      },
    });
  }

  /** Connects, and tries again at once when the browser comes back online or into view. */
  start(): void {
    window.addEventListener('online', this.#retry);
    document.addEventListener('visibilitychange', this.#retry);
    this.#client.start();
  }

  stop(): void {
    window.removeEventListener('online', this.#retry);
    document.removeEventListener('visibilitychange', this.#retry);
    this.#client.stop();
  }

  /** Seals an event of the outbox and pushes it, if the connection takes it now. */
  push(entry: GroupEventRef, bytes: Uint8Array): void {
    const key = eventKey(this.#keys, entry);
    const env = sealEnvelope(this.#keys, bytes);
    if (!this.#client.push(key, env, peekType(bytes))) return;
    const id = toBase64url(key);
    const pushed = this.#pushed.get(id) ?? { entry, waiting: new Set<string>() };
    pushed.waiting.add(toBase64url(env));
    this.#pushed.set(id, pushed);
  }

  /**
   * A batch from the server, handed on with how far it reads the server: the feed stores the
   * events with the cursor, so if they cannot be stored the server sends them again on reconnecting.
   */
  async #receive(
    batch: readonly ReceivedEnvelope[],
    server: string,
    store: string | null,
  ): Promise<void> {
    const last = batch.at(-1);
    if (last === undefined) return;
    const opened = batch.flatMap(({ key, env }) => this.#open(key, env) ?? []);
    await this.#onEvents(opened, { server, position: { cursor: last.cursor, store } });
  }

  /**
   * The event in an envelope from a relay, or null for one not sealed with this group's key, or
   * stored under another event's key: the server cannot tell, so the reader checks (protocol §8).
   */
  #open(key: Uint8Array, env: Uint8Array): Uint8Array | null {
    const bytes = openEnvelope(this.#keys, env);
    if (bytes === null) return null;
    const header = peekHeader(bytes);
    if (!header.ok) return null;
    return bytesEqual(eventKey(this.#keys, header.value), key) ? bytes : null;
  }

  async #flushOutbox(): Promise<void> {
    for (const { entry, bytes } of await pendingEvents(this.#db, this.#groupId)) {
      this.push(entry, bytes);
    }
  }

  async #confirm(key: Uint8Array, env: Uint8Array): Promise<void> {
    const id = toBase64url(key);
    const pushed = this.#pushed.get(id);
    if (pushed === undefined) return;
    pushed.waiting.delete(toBase64url(env));
    if (pushed.waiting.size > 0) return;
    this.#pushed.delete(id);
    this.#onStored(pushed.entry);
    await confirmStored(this.#db, pushed.entry);
  }
}
