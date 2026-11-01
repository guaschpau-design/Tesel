// Connecting to a MeshCore radio over Web Bluetooth (Chrome and Edge; Bluefy on the iPhone).
//
// The radio speaks the companion protocol over a Bluetooth serial service whose two
// characteristics need an encrypted link, which only pairing with the radio's PIN gives
// (MeshCore's SerialBLEInterface). A web page cannot pair by itself: the system asks for the PIN
// when something protected is read. So the radio's outgoing characteristic is read once, before
// anything else, which brings up the PIN prompt the first time. Without that read some systems
// (Chrome on Android) never ask, and the radio silently refuses every command. Each step has a
// time limit and a failure of its own, so the user is told what went wrong rather than kept
// waiting (ADR-0090).
//
// The companion commands come from meshcore.js's Connection (MIT): only the transport is written
// here, as that library means it to be extended.

// @ts-expect-error -- meshcore.js ships no type declarations; the shape is declared below.
import UntypedConnection from '@liamcottle/meshcore.js/src/connection/connection.js';
// @ts-expect-error -- as above.
import UntypedConstants from '@liamcottle/meshcore.js/src/constants.js';

import type { CompanionConnection } from './companion.ts';
import type { Connector, OpenedRadio } from './meshcore-radio.ts';
import { RadioError } from './radio-link.ts';

/** The part of Web Bluetooth used here: it is not in TypeScript's DOM library. */
interface BleCharacteristic {
  readonly properties: { readonly read: boolean };
  readonly value: DataView | null;
  readValue(): Promise<DataView>;
  /** Written with response, the only way the radio's incoming characteristic takes. */
  writeValue(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<unknown>;
  addEventListener(type: 'characteristicvaluechanged', listener: () => void): void;
}

interface BleServer {
  readonly connected: boolean;
  getPrimaryService(uuid: string): Promise<{
    getCharacteristic(uuid: string): Promise<BleCharacteristic>;
  }>;
  disconnect(): void;
}

export interface BleDevice {
  readonly name?: string;
  readonly gatt?: { connect(): Promise<BleServer> };
  addEventListener(
    type: 'gattserverdisconnected',
    listener: () => void,
    options: { once: true },
  ): void;
}

interface Bluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<BleDevice>;
}

/** What Tesel uses of meshcore.js's Connection, which a transport extends. */
interface LibraryConnection extends CompanionConnection {
  onFrameReceived(frame: Uint8Array): void;
  onDisconnected(): void;
  /** Tells the radio which companion protocol version the app speaks; answers with its own. */
  deviceQuery(appTargetVersion: number): Promise<unknown>;
  sendToRadioFrame(frame: Uint8Array): Promise<void>;
}

const Connection = UntypedConnection as new () => LibraryConnection;
const Constants = UntypedConstants as {
  readonly SupportedCompanionProtocolVersion: number;
  readonly Ble: {
    readonly ServiceUuid: string;
    readonly CharacteristicUuidRx: string;
    readonly CharacteristicUuidTx: string;
  };
};

const SERVICE = Constants.Ble.ServiceUuid.toLowerCase();
/** The radio reads what is written here. */
const RADIO_IN = Constants.Ble.CharacteristicUuidRx.toLowerCase();
/** The radio writes here what it has to say. */
const RADIO_OUT = Constants.Ble.CharacteristicUuidTx.toLowerCase();

/** How long the radio has to accept the Bluetooth connection. */
const CONNECT_MS = 15_000;
/** How long the user has to type the PIN when the system asks for it. */
const PAIRING_MS = 60_000;
/** How long the radio has to answer the first command once paired. */
const ANSWER_MS = 5000;

/** A companion connection whose frames travel over the radio's Bluetooth serial service. */
class BleConnection extends Connection {
  readonly #server: BleServer;
  readonly #radioIn: BleCharacteristic;

  constructor(server: BleServer, radioIn: BleCharacteristic) {
    super();
    this.#server = server;
    this.#radioIn = radioIn;
  }

  /** A refused write rejects the command that made it, instead of leaving it to time out. */
  override async sendToRadioFrame(frame: Uint8Array): Promise<void> {
    await this.#radioIn.writeValue(frame);
  }

  override close(): Promise<void> {
    if (this.#server.connected) this.#server.disconnect();
    return Promise.resolve();
  }
}

/**
 * Shows the browser's Bluetooth picker and resolves once the radio is ready for commands. The
 * same device is opened again without the picker when the connection drops.
 */
export const webBleConnector: Connector = async () => {
  const { bluetooth } = navigator as Navigator & { readonly bluetooth: Bluetooth };
  const device = await bluetooth.requestDevice({ filters: [{ services: [SERVICE] }] });
  return openRadio(device);
};

/** Connects to `device`, pairs if it has not yet, and checks that the radio answers. */
export async function openRadio(device: BleDevice): Promise<OpenedRadio> {
  if (device.gatt === undefined) throw new Error('the device offers no Bluetooth services');
  const server = await within(device.gatt.connect(), CONNECT_MS, 'the radio did not connect');
  try {
    const service = await server.getPrimaryService(SERVICE);
    const radioIn = await service.getCharacteristic(RADIO_IN);
    const radioOut = await service.getCharacteristic(RADIO_OUT);
    await pair(radioOut);
    const connection = new BleConnection(server, radioIn);
    radioOut.addEventListener('characteristicvaluechanged', () => {
      if (radioOut.value !== null) connection.onFrameReceived(copyOf(radioOut.value));
    });
    await radioOut.startNotifications();
    await greet(connection);
    device.addEventListener(
      'gattserverdisconnected',
      () => {
        connection.onDisconnected();
      },
      { once: true },
    );
    return { connection, name: device.name ?? null, reopen: () => openRadio(device) };
  } catch (error) {
    server.disconnect();
    throw error;
  }
}

/**
 * Reads the radio's outgoing characteristic, which needs the PIN: the first time, this is what
 * makes the system ask for it; once paired, it answers at once. A radio whose characteristic
 * cannot be read is paired by the system on the first write instead.
 */
async function pair(radioOut: BleCharacteristic): Promise<void> {
  if (!radioOut.properties.read) return;
  try {
    await within(radioOut.readValue(), PAIRING_MS, 'no PIN was given');
  } catch (error) {
    throw new RadioError('not-paired', `pairing failed: ${messageOf(error)}`);
  }
}

/**
 * Tells the radio the protocol version Tesel speaks, as the radio needs before it sends newer
 * frames. A write the system refuses means the link is not paired; silence means the radio's
 * firmware does not speak the companion protocol Tesel needs.
 */
async function greet(connection: LibraryConnection): Promise<void> {
  try {
    await within(
      connection.deviceQuery(Constants.SupportedCompanionProtocolVersion),
      ANSWER_MS,
      'the radio did not answer',
    );
  } catch (error) {
    if (error instanceof RadioError) throw error;
    // meshcore.js rejects with no value when the radio itself answers ERR.
    if (!(error instanceof Error)) throw new RadioError('refused', 'the radio refused the query');
    throw new RadioError('not-paired', `the system refused the write: ${error.message}`);
  }
}

/** Waits for `promise` at most `ms`, then rejects as a radio that did not answer. */
async function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RadioError('timeout', what));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function copyOf(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'no reason given';
}
