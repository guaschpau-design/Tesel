// What a relay client (relay-client.ts) and those who use it speak of: the link to the server, its
// status, and what it hands on (protocol §8).

/** The part of the browser's WebSocket the client uses, so tests can provide a fake. */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(text: string): void;
  close(): void;
}

export type RelayStatus = 'connecting' | 'syncing' | 'synced' | 'disconnected';

/** An envelope as the relay sent it, with its event key and cursor (protocol §8). */
export interface ReceivedEnvelope {
  readonly key: Uint8Array;
  readonly env: Uint8Array;
  readonly cursor: number;
}

/**
 * How far this device has read a group on a relay: a cursor of the relay's store, whose identity
 * is null until the relay has told it (protocol §8).
 */
export interface RelayPosition {
  readonly cursor: number;
  readonly store: string | null;
}

interface RelayHandlers {
  /** Where to join from: what this device last stored for the group. */
  readonly position: () => Promise<RelayPosition>;
  /** Joined: from now on an SOS, a cancellation or an acknowledgement can be pushed. */
  readonly onJoined: () => Promise<void>;
  /**
   * Envelopes that arrived together, in order, read from `store`. A device that has been away
   * gets thousands at once, and taking them in one go means one storage write and one redraw
   * instead of one each.
   */
  readonly onEnvelopes: (batch: readonly ReceivedEnvelope[], store: string | null) => Promise<void>;
  /**
   * The backlog is in; from now on every push is possible. `position` is how far it was read and
   * taken, or null if some of it could not be taken: the cursor then stays where it was, and the
   * client joins again later to read the rest.
   */
  readonly onSynced: (position: RelayPosition | null) => Promise<void>;
  /**
   * The relay's store is not the one this device read from: it lost its data or was restored
   * from a backup. What this device knew of it is void; the handler starts over from the start of
   * the new store and offers its own events again. The client then joins again.
   */
  readonly onStoreChanged: (store: string) => Promise<void>;
  /** The relay stored the envelope `env`, pushed under `key`. */
  readonly onStored: (key: Uint8Array, env: Uint8Array) => Promise<void>;
  /** Each try to connect starts with `connecting`. */
  readonly onStatus: (status: RelayStatus) => void;
}

export interface RelayClientOptions {
  /** The group's server, by its base URL. */
  readonly server: string;
  readonly group: Uint8Array;
  readonly handlers: RelayHandlers;
  readonly createSocket?: (url: string) => SocketLike;
  readonly random?: () => number;
}

/** One connection to the server, as its messages are handled. */
export interface Link {
  readonly socket: SocketLike;
  /** The store it reads from as far as this device knew when it joined. */
  store: string | null;
  /** Batches of envelopes waiting to be handed on. */
  waiting: number;
  /**
   * Whether envelopes are still taken. Once one is left out, the cursor must stay behind it: the
   * link takes no more, and is joined again later to read them again.
   */
  taking: boolean;
  /** A batch could not be handed on: those queued after it are left out too. */
  failed: boolean;
}
