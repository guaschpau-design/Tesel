// RadioLink over a Meshtastic radio (protocol §7.2, ADR-0098).
//
// The group's channel is one of the radio's secondary channels, named after the group, whose key
// is the group secret; Tesel's sealed frames travel on it as packets to everyone on Meshtastic's
// PRIVATE_APP port. Channels are set with an admin message to the radio itself. Commands go
// through the same keeper as MeshCore's, one at a time with a timeout, and the link connects again
// by itself when Bluetooth drops (packages/radio, ADR-0043).

import { MESHTASTIC_PORTNUM } from '@tesel/protocol';
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

import { meshtasticAirtimeMs } from './air.ts';
import { CHANNEL_NAME_MAX_BYTES, chooseChannel, groupSecretOf, withChannel } from './channels.ts';
import type { Incoming, MeshtasticConnection, RadioSetup } from './connection.ts';
import { positionOf, userOf, type MeshPacket } from './from-radio.ts';
import { NodeBook, type MeshtasticNode } from './nodes.ts';
import { ProtoMessage } from './protobuf.ts';
import { BROADCAST, PORT } from './schema.ts';
import { setChannel, type ChannelEntry } from './to-radio.ts';

/** Repeats a packet may take when the radio does not say its own limit: Meshtastic's default. */
const DEFAULT_HOP_LIMIT = 3;

const NO_SETUP: RadioSetup = { myNodeNum: 0, channels: [], lora: null, nodes: [] };

export class MeshtasticRadio implements RadioLink {
  readonly family = 'meshtastic';
  readonly #keeper: ConnectionKeeper<MeshtasticConnection>;
  /** What the radio told when it connected, with the channels as Tesel has set them since. */
  #setup: RadioSetup = NO_SETUP;
  #channel: number | null = null;
  #unsubscribe: (() => void)[] = [];
  readonly #nodes = new NodeBook();
  readonly #receivers = new Set<(frame: ReceivedFrame) => void>();
  readonly #textListeners = new Set<(message: RadioText) => void>();
  readonly #nodeListeners = new Set<(node: MeshtasticNode) => void>();

  constructor(connector: Connector<MeshtasticConnection>) {
    this.#keeper = new ConnectionKeeper(connector, {
      opened: (connection) => {
        this.#setup = connection.setup;
        for (const record of connection.setup.nodes) {
          if (record.num !== connection.setup.myNodeNum) this.#tellNode(this.#nodes.learn(record));
        }
        this.#unsubscribe = [
          connection.onIncoming((incoming) => {
            this.#hear(incoming);
          }),
          connection.onDisconnected(() => {
            this.#keeper.lost();
          }),
        ];
      },
      released: () => {
        for (const unsubscribe of this.#unsubscribe) unsubscribe();
        this.#unsubscribe = [];
        this.#setup = NO_SETUP;
        this.#channel = null;
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
    const choice = chooseChannel(this.#setup.channels, secret);
    if (choice.kind === 'full') {
      throw new RadioError('no-free-channel', 'every channel of the radio is in use');
    }
    if (choice.kind === 'empty') {
      const name = channelName(groupName, CHANNEL_NAME_MAX_BYTES);
      await this.#setChannel(connection, {
        index: choice.index,
        role: 'secondary',
        psk: secret,
        name,
      });
    }
    this.#channel = choice.index;
  }

  async forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void> {
    const connection = this.#keeper.ready();
    const left = this.#setup.channels.filter((channel) => {
      const held = groupSecretOf(channel);
      return held !== null && matches(held);
    });
    for (const { index } of left) {
      const disabled: ChannelEntry = { index, role: 'disabled', psk: new Uint8Array(0), name: '' };
      await this.#setChannel(connection, disabled);
      if (this.#channel === index) this.#channel = null;
    }
  }

  async send(bytes: Uint8Array): Promise<SendOutcome> {
    const connection = this.#keeper.connection;
    const channel = this.#channel;
    if (connection === null || channel === null) {
      return { status: 'failed', reason: 'radio not ready' };
    }
    // A packet sent with no hop limit would not be repeated at all.
    const configured = this.#setup.lora?.hopLimit ?? 0;
    const hopLimit = configured > 0 ? configured : DEFAULT_HOP_LIMIT;
    try {
      await this.#keeper.command(() =>
        connection.sendPacket({
          to: BROADCAST,
          channel,
          hopLimit,
          portnum: MESHTASTIC_PORTNUM,
          payload: bytes,
        }),
      );
      return { status: 'sent' };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.message : 'refused' };
    }
  }

  airtimeMs(frameBytes: number): number {
    return meshtasticAirtimeMs(frameBytes, this.#setup.lora);
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receivers.add(listener);
    return () => this.#receivers.delete(listener);
  }

  onText(listener: (message: RadioText) => void): () => void {
    this.#textListeners.add(listener);
    return () => this.#textListeners.delete(listener);
  }

  /**
   * Subscribes to the other Meshtastic nodes this radio hears: their names and where they say they
   * are, each time that changes, starting with those the radio knew when it connected. Not part of
   * RadioLink: only Meshtastic radios tell this. Returns an unsubscribe function.
   */
  onNode(listener: (node: MeshtasticNode) => void): () => void {
    this.#nodeListeners.add(listener);
    return () => this.#nodeListeners.delete(listener);
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    return this.#keeper.onStateChange(listener);
  }

  disconnect(): Promise<void> {
    return this.#keeper.disconnect();
  }

  /** Sets one of the radio's channels with an admin message to the radio itself. */
  async #setChannel(connection: MeshtasticConnection, channel: ChannelEntry): Promise<void> {
    await this.#keeper.command(() =>
      connection.sendPacket({
        to: this.#setup.myNodeNum,
        channel: 0,
        hopLimit: 0,
        portnum: PORT.admin,
        payload: setChannel(channel),
      }),
    );
    this.#setup = {
      ...this.#setup,
      channels: withChannel(this.#setup.channels, channel),
    };
  }

  #hear(incoming: Incoming): void {
    if (incoming.kind === 'node') {
      if (incoming.node.num !== this.#setup.myNodeNum)
        this.#tellNode(this.#nodes.learn(incoming.node));
      return;
    }
    const { packet } = incoming;
    // A radio may hand back what it sent itself.
    if (packet.from === this.#setup.myNodeNum) return;
    switch (packet.portnum) {
      case MESHTASTIC_PORTNUM:
        this.#hearFrame(packet);
        return;
      case PORT.textMessage:
        this.#hearText(packet);
        return;
      case PORT.nodeInfo:
      case PORT.position:
        this.#hearNode(packet);
        return;
    }
  }

  /** A Tesel frame, on any channel that holds a group secret, passed on with that secret. */
  #hearFrame(packet: MeshPacket): void {
    const channel = this.#setup.channels.find(({ index }) => index === packet.channel);
    const secret = channel === undefined ? null : groupSecretOf(channel);
    if (secret === null) return;
    for (const receiver of this.#receivers) {
      receiver({ bytes: packet.payload, snr: packet.rxSnr, secret });
    }
  }

  #hearText(packet: MeshPacket): void {
    const channel = this.#setup.channels.find(({ index }) => index === packet.channel);
    const text: RadioText = {
      kind: packet.to === BROADCAST ? 'channel' : 'direct',
      // The primary channel often has no name of its own: Meshtastic shows its preset's.
      channel: channel === undefined || channel.name === '' ? null : channel.name,
      sender: this.#nodes.nameOf(packet.from),
      text: new TextDecoder().decode(packet.payload),
      time: packet.rxTime === 0 ? Math.floor(Date.now() / 1000) : packet.rxTime,
    };
    for (const listener of this.#textListeners) listener(text);
  }

  #hearNode(packet: MeshPacket): void {
    const parsed = ProtoMessage.parse(packet.payload);
    if (!parsed.ok) return;
    const at = packet.rxTime;
    const node =
      packet.portnum === PORT.nodeInfo
        ? this.#nodes.heard(packet.from, { user: userOf(parsed.value), at })
        : this.#nodes.heard(packet.from, { position: positionOf(parsed.value), at });
    this.#tellNode(node);
  }

  #tellNode(node: MeshtasticNode): void {
    for (const listener of this.#nodeListeners) listener(node);
  }
}
