// Keeping a link's connection to its radio, the same for every kind of radio (ADR-0043, ADR-0098).
//
// Every command goes through one queue and has a timeout, in case the radio never answers (old
// firmware, lost Bluetooth link). A late answer could be taken for the next command's, so a radio
// that misses the timeout is dropped and connected again from clean. A lost connection is retried
// by itself, with growing pauses, until the user disconnects: a radio in a pocket loses Bluetooth
// now and then.

import { RadioError, type RadioLinkState } from './radio-link.ts';
import { within } from './time-limit.ts';

/** An open connection to a radio, and how to open it again without asking the user. */
export interface OpenedRadio<Connection> {
  readonly connection: Connection;
  readonly name: string | null;
  readonly reopen: () => Promise<OpenedRadio<Connection>>;
}

/** Opens a connection to the radio a link was made for. */
export type Connector<Connection> = () => Promise<OpenedRadio<Connection>>;

/** What the keeper needs of any connection. */
export interface ClosableConnection {
  close(): Promise<void>;
}

/** What a link does as connections come and go. */
interface ConnectionHooks<Connection> {
  /** A connection is open: listen to it; when it says it dropped, call `lost`. */
  opened(connection: Connection): void;
  /** The connection is let go: stop listening, and forget what was learnt from it. */
  released(connection: Connection): void;
}

const COMMAND_TIMEOUT_MS = 5000;
/** Reconnection attempts after a lost connection: first after this long, doubling up to the cap. */
const RECONNECT_FIRST_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export class ConnectionKeeper<Connection extends ClosableConnection> {
  readonly #connector: Connector<Connection>;
  readonly #hooks: ConnectionHooks<Connection>;
  #connection: Connection | null = null;
  #state: RadioLinkState = 'disconnected';
  #name: string | null = null;
  /** How to open the same radio again; null once the user disconnects. */
  #reopen: (() => Promise<OpenedRadio<Connection>>) | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reconnectDelayMs = RECONNECT_FIRST_MS;
  #queue: Promise<unknown> = Promise.resolve();
  readonly #stateListeners = new Set<(state: RadioLinkState) => void>();

  constructor(connector: Connector<Connection>, hooks: ConnectionHooks<Connection>) {
    this.#connector = connector;
    this.#hooks = hooks;
  }

  get state(): RadioLinkState {
    return this.#state;
  }

  get name(): string | null {
    return this.#name;
  }

  /** The open connection, if any; it may not have finished opening. */
  get connection(): Connection | null {
    return this.#connection;
  }

  async connect(): Promise<void> {
    if (this.#state !== 'disconnected') return;
    this.#setState('connecting');
    let opened: OpenedRadio<Connection>;
    try {
      opened = await this.#connector();
    } catch (error) {
      if (this.state === 'connecting') this.#reset('disconnected');
      throw error;
    }
    // Disconnected while the radio was being opened: let it go.
    if (this.state !== 'connecting') {
      void opened.connection.close();
      return;
    }
    this.#open(opened);
  }

  async disconnect(): Promise<void> {
    const connection = this.#connection;
    this.#reopen = null;
    this.#reset('disconnected');
    await connection?.close();
  }

  /**
   * The connection dropped: connect to the same radio again, unless the user disconnected. The link
   * goes straight to `connecting`, never through `disconnected`, so the app keeps it for the group.
   */
  lost(): void {
    const reopen = this.#reopen;
    const connection = this.#connection;
    this.#reset(reopen === null ? 'disconnected' : 'connecting');
    void connection?.close();
    if (reopen !== null) this.#scheduleReconnect(reopen);
  }

  /** The open connection, or a `not-ready` failure. */
  ready(): Connection {
    if (this.#connection === null || this.#state !== 'ready') {
      throw new RadioError('not-ready', 'the radio is not connected');
    }
    return this.#connection;
  }

  /** Runs one command after the previous one has finished, with a timeout. */
  command<T>(run: () => Promise<T>): Promise<T> {
    const connection = this.#connection;
    const result = this.#queue.then(() =>
      within(run(), COMMAND_TIMEOUT_MS, 'the radio did not answer'),
    );
    this.#queue = result.catch((error: unknown) => {
      // A late answer could be taken for the next command's: start clean on a new connection. A
      // command left on a connection already replaced says nothing of the current one.
      const timedOut = error instanceof RadioError && error.code === 'timeout';
      if (timedOut && connection !== null && connection === this.#connection) this.lost();
    });
    return result;
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  #open(opened: OpenedRadio<Connection>): void {
    this.#connection = opened.connection;
    this.#name = opened.name;
    this.#reopen = opened.reopen;
    this.#reconnectDelayMs = RECONNECT_FIRST_MS;
    this.#hooks.opened(opened.connection);
    this.#setState('ready');
  }

  #scheduleReconnect(reopen: () => Promise<OpenedRadio<Connection>>): void {
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      reopen().then(
        (opened) => {
          if (this.#reopen === null) void opened.connection.close();
          else this.#open(opened);
        },
        () => {
          if (this.#reopen === null) return;
          this.#reconnectDelayMs = Math.min(this.#reconnectDelayMs * 2, RECONNECT_MAX_MS);
          this.#scheduleReconnect(reopen);
        },
      );
    }, this.#reconnectDelayMs);
  }

  /** Lets the connection go and moves to `next`; commands of the next connection queue anew. */
  #reset(next: RadioLinkState): void {
    if (this.#connection !== null) this.#hooks.released(this.#connection);
    if (this.#reconnectTimer !== null) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#connection = null;
    this.#queue = Promise.resolve();
    this.#name = null;
    this.#setState(next);
  }

  #setState(state: RadioLinkState): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#stateListeners) listener(state);
  }
}
