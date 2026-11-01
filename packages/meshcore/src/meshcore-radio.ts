// RadioLink over a MeshCore companion radio (protocol §7, ADR-0006).
//
// The companion protocol answers commands with generic OK/ERR frames, so two commands in flight
// at once could take each other's answers. Every command therefore goes through one queue, and
// each has a timeout in case the radio never answers (old firmware, lost Bluetooth link). A late
// answer could still be taken for the next command's, so a radio that misses the timeout is
// dropped and connected again from clean. A lost connection is retried by itself, with growing
// pauses, until the user disconnects: a radio in a pocket loses Bluetooth now and then.

import { channelName, chooseChannelSlot } from './channel-slot.ts';
import {
  FLOOD,
  PUSH_MSG_WAITING,
  type ChannelInfo,
  type ChannelMessage,
  type CompanionConnection,
  type ContactMessage,
  type SyncedMessage,
} from './companion.ts';
import { ACCEPTED_DATA_TYPES, SEND_DATA_TYPE } from './data-type.ts';
import {
  RadioError,
  type RadioLink,
  type RadioLinkState,
  type RadioText,
  type ReceivedFrame,
  type SendOutcome,
} from './radio-link.ts';

/** An open connection to a radio, and how to open it again without asking the user. */
export interface OpenedRadio {
  readonly connection: CompanionConnection;
  readonly name: string | null;
  readonly reopen: () => Promise<OpenedRadio>;
}

/** Opens a connection; for Web Bluetooth this asks the user to pick a radio. */
export type Connector = () => Promise<OpenedRadio>;

const COMMAND_TIMEOUT_MS = 5000;
/** Reconnection attempts after a lost connection: first after this long, doubling up to the cap. */
const RECONNECT_FIRST_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
/** MeshCore companion firmware has at most this many channel slots. */
const MAX_CHANNELS = 40;

export class MeshCoreRadio implements RadioLink {
  readonly #connector: Connector;
  #connection: CompanionConnection | null = null;
  #state: RadioLinkState = 'disconnected';
  #name: string | null = null;
  /** How to open the same radio again; null once the user disconnects. */
  #reopen: (() => Promise<OpenedRadio>) | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reconnectDelayMs = RECONNECT_FIRST_MS;
  #channel: number | null = null;
  /** Secrets by slot, learnt when configuring the group channel. */
  #channelSecrets = new Map<number, Uint8Array>();
  #queue: Promise<unknown> = Promise.resolve();
  #draining = false;
  #drainRequested = false;
  readonly #receivers = new Set<(frame: ReceivedFrame) => void>();
  readonly #textListeners = new Set<(message: RadioText) => void>();
  /** Channel names by slot, learnt when configuring the group channel. */
  #channelNames = new Map<number, string>();
  readonly #stateListeners = new Set<(state: RadioLinkState) => void>();
  readonly #onMessageWaiting = () => void this.#drain();
  readonly #onDisconnected = () => {
    this.#lost();
  };

  constructor(connector: Connector) {
    this.#connector = connector;
  }

  get state(): RadioLinkState {
    return this.#state;
  }

  get name(): string | null {
    return this.#name;
  }

  async connect(): Promise<void> {
    if (this.#state !== 'disconnected') return;
    this.#setState('connecting');
    try {
      this.#open(await this.#connector());
    } catch (error) {
      this.#reset();
      throw error;
    }
  }

  async configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void> {
    const connection = this.#ready();
    const channels = await this.#listChannels(connection);
    this.#learn(channels);
    const choice = chooseChannelSlot(channels, secret);
    if (choice.kind === 'full') {
      throw new RadioError('no-free-channel', 'every channel slot of the radio is in use');
    }
    if (choice.kind === 'empty') {
      await this.#command(() =>
        connection.setChannel(choice.index, channelName(groupName), secret),
      );
      this.#channelSecrets.set(choice.index, secret);
      this.#channelNames.set(choice.index, channelName(groupName));
    }
    this.#channel = choice.index;
    // Pick up anything that arrived for the group before we were listening.
    void this.#drain();
  }

  async forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void> {
    const connection = this.#ready();
    const channels = await this.#listChannels(connection);
    // Slot 0 is MeshCore's public channel: never Tesel's to clear.
    const left = channels.filter((channel) => channel.channelIdx !== 0 && matches(channel.secret));
    for (const { channelIdx } of left) {
      await this.#command(() => connection.setChannel(channelIdx, '', new Uint8Array(16)));
      if (this.#channel === channelIdx) this.#channel = null;
    }
    if (left.length > 0) this.#learn(await this.#listChannels(connection));
  }

  async send(bytes: Uint8Array): Promise<SendOutcome> {
    const connection = this.#connection;
    const channel = this.#channel;
    if (connection === null || channel === null) {
      return { status: 'failed', reason: 'radio not ready' };
    }
    try {
      await this.#command(() =>
        connection.sendChannelData(channel, FLOOD, new Uint8Array(0), SEND_DATA_TYPE, bytes),
      );
      return { status: 'sent' };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.message : 'refused' };
    }
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receivers.add(listener);
    return () => this.#receivers.delete(listener);
  }

  onText(listener: (message: RadioText) => void): () => void {
    this.#textListeners.add(listener);
    return () => this.#textListeners.delete(listener);
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  async disconnect(): Promise<void> {
    const connection = this.#connection;
    this.#reopen = null;
    this.#reset();
    await connection?.close();
  }

  #open(opened: OpenedRadio): void {
    this.#connection = opened.connection;
    this.#name = opened.name;
    this.#reopen = opened.reopen;
    this.#reconnectDelayMs = RECONNECT_FIRST_MS;
    opened.connection.on(PUSH_MSG_WAITING, this.#onMessageWaiting);
    opened.connection.on('disconnected', this.#onDisconnected);
    this.#setState('ready');
  }

  /** The connection dropped: connect to the same radio again, unless the user disconnected. */
  #lost(): void {
    const reopen = this.#reopen;
    const connection = this.#connection;
    this.#reset();
    void connection?.close();
    if (reopen === null) return;
    this.#reopen = reopen;
    this.#setState('connecting');
    this.#scheduleReconnect(reopen);
  }

  #scheduleReconnect(reopen: () => Promise<OpenedRadio>): void {
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

  #learn(channels: readonly ChannelInfo[]): void {
    this.#channelNames = new Map(channels.map((channel) => [channel.channelIdx, channel.name]));
    this.#channelSecrets = new Map(
      channels
        .filter((channel) => channel.channelIdx !== 0 && channel.secret.some((byte) => byte !== 0))
        .map((channel) => [channel.channelIdx, channel.secret]),
    );
  }

  /** Reads channel slots until the radio says there are no more. */
  async #listChannels(connection: CompanionConnection): Promise<ChannelInfo[]> {
    const channels: ChannelInfo[] = [];
    for (let index = 0; index < MAX_CHANNELS; index++) {
      try {
        channels.push(await this.#command(() => connection.getChannel(index)));
      } catch (error) {
        // The radio's error answer marks the end of the slots; anything else is a real failure.
        if (error instanceof RadioError && error.code === 'refused') break;
        throw error;
      }
    }
    return channels;
  }

  /**
   * Fetches every message the radio is holding and passes ours on. A notice that arrives while
   * draining makes the loop run once more, so no message is left waiting. Until the group channel
   * is set, messages stay in the radio: reading them earlier would lose the group's datagrams.
   * Datagrams of every channel with a secret are passed on with it, so those of a group that is
   * not active now are kept for it too.
   */
  async #drain(): Promise<void> {
    this.#drainRequested = true;
    if (this.#draining || this.#channel === null) return;
    this.#draining = true;
    try {
      while (this.#drainRequested) {
        this.#drainRequested = false;
        await this.#drainOnce();
      }
    } catch (error) {
      console.warn('Reading from the radio failed', error);
    } finally {
      this.#draining = false;
    }
  }

  async #drainOnce(): Promise<void> {
    const connection = this.#connection;
    if (connection === null) return;
    for (;;) {
      const message = await this.#command(() => connection.syncNextMessage());
      if (message === null) return;
      this.#deliver(message);
    }
  }

  #deliver(message: NonNullable<SyncedMessage>): void {
    if ('channelData' in message) {
      const { channelIdx, dataType, data, snr } = message.channelData;
      const secret = this.#channelSecrets.get(channelIdx);
      if (secret === undefined || !ACCEPTED_DATA_TYPES.includes(dataType)) return;
      for (const receiver of this.#receivers) receiver({ bytes: data, snr, secret });
      return;
    }
    const text =
      'channelMessage' in message
        ? channelText(message.channelMessage, this.#channelNames)
        : directText(message.contactMessage);
    for (const listener of this.#textListeners) listener(text);
  }

  /** Runs one command after the previous one has finished, with a timeout. */
  #command<T>(run: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(() => withTimeout(run()));
    this.#queue = result.catch((error: unknown) => {
      // A late answer could be taken for the next command's: start clean on a new connection.
      if (error instanceof RadioError && error.code === 'timeout') this.#lost();
    });
    return result;
  }

  #ready(): CompanionConnection {
    if (this.#connection === null || this.#state !== 'ready') {
      throw new RadioError('not-ready', 'the radio is not connected');
    }
    return this.#connection;
  }

  #reset(): void {
    this.#connection?.off(PUSH_MSG_WAITING, this.#onMessageWaiting);
    this.#connection?.off('disconnected', this.#onDisconnected);
    if (this.#reconnectTimer !== null) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#connection = null;
    this.#channel = null;
    this.#channelSecrets = new Map();
    this.#name = null;
    this.#setState('disconnected');
  }

  #setState(state: RadioLinkState): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#stateListeners) listener(state);
  }
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RadioError('timeout', 'the radio did not answer'));
    }, COMMAND_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise.catch(rethrowAsRefused), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** meshcore.js rejects with no value when the radio answers ERR. */
function rethrowAsRefused(error: unknown): never {
  if (error instanceof Error) throw error;
  throw new RadioError('refused', 'the radio refused the command');
}

/** MeshCore puts the sender's name at the start of channel messages: "Name: text". */
function channelText(message: ChannelMessage, names: ReadonlyMap<number, string>): RadioText {
  const separator = message.text.indexOf(': ');
  const named = separator > 0 && separator <= 32;
  return {
    kind: 'channel',
    channel: names.get(message.channelIdx) ?? null,
    sender: named ? message.text.slice(0, separator) : null,
    text: named ? message.text.slice(separator + 2) : message.text,
    time: message.senderTimestamp,
  };
}

function directText(message: ContactMessage): RadioText {
  const hex = [...message.pubKeyPrefix].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    kind: 'direct',
    channel: null,
    sender: hex,
    text: message.text,
    time: message.senderTimestamp,
  };
}
