// A Meshtastic connection over the radio's Bluetooth service (ADR-0098): reading FromRadio until
// it is empty whenever the radio says there is more, writing ToRadio, the configuration handshake,
// and telling which packets the radio took into its queue.

import {
  copyOf,
  messageOf,
  RadioError,
  type BleCharacteristic,
  type BleDevice,
  type BleServer,
} from '@tesel/radio';

import { withChannel } from './channels.ts';
import type { Incoming, MeshtasticConnection } from './connection.ts';
import {
  decodeFromRadio,
  type FromRadio,
  type LoraSettings,
  type NodeRecord,
} from './from-radio.ts';
import { toRadioPacket, wantConfig, type ChannelEntry, type OutgoingPacket } from './to-radio.ts';

/** How long the radio may stay silent while it tells its configuration. */
const ANSWER_MS = 5000;
/** Packets heard before the link listens are kept for it, at most this many. */
const MAX_UNHEARD = 100;

interface Waiting {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

/** A Meshtastic connection over the radio's Bluetooth service. */
export class BleConnection implements MeshtasticConnection {
  readonly #server: BleServer;
  readonly #toRadio: BleCharacteristic;
  readonly #fromRadio: BleCharacteristic;
  readonly #setup = {
    myNodeNum: 0,
    channels: [] as ChannelEntry[],
    lora: null as LoraSettings | null,
    nodes: [] as NodeRecord[],
  };
  /** True once the configuration is complete: nodes heard later are news, not setup. */
  #configured = false;
  /** While the configuration comes: the silence that fails it, renewed by every message. */
  #silence: { readonly nonce: number; renew(): void; finish(): void } | null = null;
  #closed = false;
  #reading = false;
  #readRequested = false;
  /** Packets handed to the radio, by id, until it says it took them. */
  readonly #waiting = new Map<number, Waiting>();
  #unheard: Incoming[] = [];
  readonly #listeners = new Set<(incoming: Incoming) => void>();
  readonly #disconnectListeners = new Set<() => void>();

  constructor(
    device: BleDevice,
    server: BleServer,
    toRadio: BleCharacteristic,
    fromRadio: BleCharacteristic,
  ) {
    this.#server = server;
    this.#toRadio = toRadio;
    this.#fromRadio = fromRadio;
    device.addEventListener(
      'gattserverdisconnected',
      () => {
        this.#dropped();
      },
      { once: true },
    );
  }

  get setup(): MeshtasticConnection['setup'] {
    return this.#setup;
  }

  /** Asks for the radio's configuration and resolves once it has all been told. */
  async configure(): Promise<void> {
    const nonce = randomId();
    const told = new Promise<void>((resolve, reject) => {
      const fail = () => {
        this.#silence = null;
        reject(new RadioError('timeout', 'the radio did not answer'));
      };
      let timer = setTimeout(fail, ANSWER_MS);
      this.#silence = {
        nonce,
        renew: () => {
          clearTimeout(timer);
          timer = setTimeout(fail, ANSWER_MS);
        },
        finish: () => {
          clearTimeout(timer);
          this.#silence = null;
          resolve();
        },
      };
    });
    try {
      await this.#write(wantConfig(nonce));
    } catch (error) {
      this.#silence?.finish();
      // The first write is the one an unpaired link refuses.
      throw new RadioError('not-paired', `the system refused the write: ${messageOf(error)}`);
    }
    await told;
    this.#configured = true;
  }

  async sendPacket(packet: Omit<OutgoingPacket, 'id'>): Promise<void> {
    const id = randomId();
    // Waiting before the write: the radio may say it took the packet before the write resolves.
    const taken = new Promise<void>((resolve, reject) => {
      this.#waiting.set(id, { resolve, reject });
    });
    // A refused write drops the connection, which rejects this packet's wait too, while the
    // write's own error is the one thrown: that rejection is expected and let go.
    taken.catch(() => undefined);
    await this.#write(toRadioPacket({ ...packet, id }));
    return taken;
  }

  onIncoming(listener: (incoming: Incoming) => void): () => void {
    this.#listeners.add(listener);
    const unheard = this.#unheard;
    this.#unheard = [];
    for (const incoming of unheard) listener(incoming);
    return () => this.#listeners.delete(listener);
  }

  onDisconnected(listener: () => void): () => void {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  close(): Promise<void> {
    this.#end();
    return Promise.resolve();
  }

  /** Reads FromRadio until it is empty; asked again while reading, it reads once more. */
  async readAll(): Promise<void> {
    this.#readRequested = true;
    if (this.#reading || this.#closed) return;
    this.#reading = true;
    try {
      while (this.#moreToRead()) {
        this.#readRequested = false;
        for (;;) {
          const view = await this.#fromRadio.readValue();
          // Closed meanwhile: what is left is for the next connection to ask for.
          if (view.byteLength === 0 || !this.#isOpen()) break;
          this.#handle(copyOf(view));
        }
      }
    } catch (error) {
      console.warn('Reading from the radio failed', error);
      this.#dropped();
    } finally {
      this.#reading = false;
    }
  }

  /** Whether a read was asked for since the last one began, on a connection still open. */
  #moreToRead(): boolean {
    return this.#readRequested && this.#isOpen();
  }

  #isOpen(): boolean {
    return !this.#closed;
  }

  /** A write the system refuses drops the connection, so the link connects again at once. */
  async #write(bytes: Uint8Array): Promise<void> {
    try {
      await this.#toRadio.writeValue(bytes);
    } catch (error) {
      this.#dropped();
      throw error;
    }
    void this.readAll();
  }

  #handle(bytes: Uint8Array): void {
    const decoded = decodeFromRadio(bytes);
    if (!decoded.ok) {
      console.warn('A message from the radio could not be read', decoded.error);
      return;
    }
    this.#silence?.renew();
    this.#take(decoded.value);
  }

  #take(message: FromRadio): void {
    switch (message.kind) {
      case 'my-info':
        this.#setup.myNodeNum = message.myNodeNum;
        return;
      case 'channel':
        this.#setup.channels = withChannel(this.#setup.channels, message.channel);
        return;
      case 'lora':
        this.#setup.lora = message.lora;
        return;
      case 'node':
        if (this.#configured) this.#tell({ kind: 'node', node: message.node });
        else this.#setup.nodes.push(message.node);
        return;
      case 'config-complete':
        if (this.#silence?.nonce === message.id) this.#silence.finish();
        return;
      case 'queue-status':
        this.#taken(message.packetId, message.res);
        return;
      case 'packet':
        this.#tell({ kind: 'packet', packet: message.packet });
        return;
      case 'rebooted':
        // What the radio told may have changed: connect again and ask anew.
        this.#dropped();
        return;
      case 'other':
        return;
    }
  }

  /** The radio says whether it took a packet into its queue: 0 is yes, anything else an error. */
  #taken(packetId: number, res: number): void {
    const waiting = this.#waiting.get(packetId);
    if (waiting === undefined) return;
    this.#waiting.delete(packetId);
    if (res === 0) waiting.resolve();
    else waiting.reject(new RadioError('refused', `the radio did not take the packet (${res})`));
  }

  #tell(incoming: Incoming): void {
    if (this.#listeners.size === 0) {
      this.#unheard = [...this.#unheard, incoming].slice(-MAX_UNHEARD);
      return;
    }
    for (const listener of this.#listeners) listener(incoming);
  }

  /** The connection is gone: say so once, and let the radio go. */
  #dropped(): void {
    if (this.#closed) return;
    this.#end();
    for (const listener of this.#disconnectListeners) listener();
  }

  #end(): void {
    this.#closed = true;
    for (const waiting of this.#waiting.values()) {
      waiting.reject(new RadioError('not-ready', 'the radio is not connected'));
    }
    this.#waiting.clear();
    if (this.#server.connected) this.#server.disconnect();
  }
}

/** A packet id or nonce: random, never 0, which Meshtastic reads as "none". */
function randomId(): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return value === undefined || value === 0 ? 1 : value;
}
