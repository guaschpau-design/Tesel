// RadioLink over a MeshCore companion radio (protocol §7.1, ADR-0006).
//
// The companion protocol answers commands with generic OK/ERR frames, so two commands in flight
// at once could take each other's answers: the connection keeper runs them one at a time, with a
// timeout, and connects again when the link drops (packages/radio, ADR-0043).

import {
  channelName,
  ConnectionKeeper,
  RadioError,
  type Connector,
  type RadioLink,
  type RadioLinkState,
  type RadioText,
  type ReceivedFrame,
  type SendOutcome,
} from '@tesel/radio';

import { meshcoreAirtimeMs } from './air.ts';
import { CHANNEL_NAME_MAX_BYTES, chooseChannelSlot } from './channel-slot.ts';
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

/** MeshCore companion firmware has at most this many channel slots. */
const MAX_CHANNELS = 40;

export class MeshCoreRadio implements RadioLink {
  readonly family = 'meshcore';
  readonly #keeper: ConnectionKeeper<CompanionConnection>;
  #channel: number | null = null;
  /** Secrets by slot, learnt when configuring the group channel. */
  #channelSecrets = new Map<number, Uint8Array>();
  #draining = false;
  #drainRequested = false;
  readonly #receivers = new Set<(frame: ReceivedFrame) => void>();
  readonly #textListeners = new Set<(message: RadioText) => void>();
  /** Channel names by slot, learnt when configuring the group channel. */
  #channelNames = new Map<number, string>();
  readonly #onMessageWaiting = () => void this.#drain();
  readonly #onDisconnected = () => {
    this.#keeper.lost();
  };

  constructor(connector: Connector<CompanionConnection>) {
    this.#keeper = new ConnectionKeeper(connector, {
      opened: (connection) => {
        connection.on(PUSH_MSG_WAITING, this.#onMessageWaiting);
        connection.on('disconnected', this.#onDisconnected);
      },
      released: (connection) => {
        connection.off(PUSH_MSG_WAITING, this.#onMessageWaiting);
        connection.off('disconnected', this.#onDisconnected);
        this.#channel = null;
        this.#channelSecrets = new Map();
      },
    });
  }

  get state(): RadioLinkState {
    return this.#keeper.state;
  }

  get name(): string | null {
    return this.#keeper.name;
  }

  connect(): Promise<void> {
    return this.#keeper.connect();
  }

  async configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void> {
    const connection = this.#keeper.ready();
    const channels = await this.#listChannels(connection);
    this.#learn(channels);
    const choice = chooseChannelSlot(channels, secret);
    if (choice.kind === 'full') {
      throw new RadioError('no-free-channel', 'every channel slot of the radio is in use');
    }
    if (choice.kind === 'empty') {
      const name = channelName(groupName, CHANNEL_NAME_MAX_BYTES);
      await this.#command(() => connection.setChannel(choice.index, name, secret));
      this.#channelSecrets.set(choice.index, secret);
      this.#channelNames.set(choice.index, name);
    }
    this.#channel = choice.index;
    // Pick up anything that arrived for the group before we were listening.
    void this.#drain();
  }

  async forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void> {
    const connection = this.#keeper.ready();
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
    const connection = this.#keeper.connection;
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

  airtimeMs(eventBytes: number): number {
    return meshcoreAirtimeMs(eventBytes);
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
    return this.#keeper.onStateChange(listener);
  }

  disconnect(): Promise<void> {
    return this.#keeper.disconnect();
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
    const connection = this.#keeper.connection;
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

  /** One companion command through the keeper's queue. */
  #command<T>(run: () => Promise<T>): Promise<T> {
    return this.#keeper.command(() => run().catch(rethrowAsRefused));
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
