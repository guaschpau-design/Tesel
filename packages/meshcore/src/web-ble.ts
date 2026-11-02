// Connecting to a MeshCore radio over Web Bluetooth.
//
// The radio speaks the companion protocol over a Bluetooth serial service whose two
// characteristics need an encrypted link, which only pairing with the radio's PIN gives
// (MeshCore's SerialBLEInterface). So the radio's outgoing characteristic is read once, before
// anything else, which brings up the PIN prompt the first time (ADR-0090).
//
// The companion commands come from meshcore.js's Connection (MIT): only the transport is written
// here, as that library means it to be extended.

// @ts-expect-error -- meshcore.js ships no type declarations; the shape is declared below.
import UntypedConnection from '@liamcottle/meshcore.js/src/connection/connection.js';
// @ts-expect-error -- as above.
import UntypedConstants from '@liamcottle/meshcore.js/src/constants.js';
import {
  connectGatt,
  copyOf,
  openOn,
  pair,
  RadioError,
  within,
  type BleCharacteristic,
  type BleDevice,
  type BleServer,
  type OpenedRadio,
} from '@tesel/radio';

import type { CompanionConnection } from './companion.ts';
import { MeshCoreRadio } from './meshcore-radio.ts';
import { MESHCORE_SERVICE } from './service.ts';

/** What Tesel uses of meshcore.js's Connection, which a transport extends. */
interface LibraryConnection extends CompanionConnection {
  onFrameReceived(frame: Uint8Array): void;
  onDisconnected(): void;
  /** Tells the radio which companion protocol version the app speaks; answers with its own. */
  deviceQuery(appTargetVersion: number): Promise<unknown>;
  sendToRadioFrame(frame: Uint8Array): Promise<void>;
  sendCommandSyncNextMessage(): Promise<void>;
}

const Connection = UntypedConnection as new () => LibraryConnection;
const Constants = UntypedConstants as {
  readonly SupportedCompanionProtocolVersion: number;
  readonly Ble: {
    readonly CharacteristicUuidRx: string;
    readonly CharacteristicUuidTx: string;
  };
};

/** The radio reads what is written here. */
const RADIO_IN = Constants.Ble.CharacteristicUuidRx.toLowerCase();
/** The radio writes here what it has to say. */
const RADIO_OUT = Constants.Ble.CharacteristicUuidTx.toLowerCase();

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

  /**
   * A refused write rejects the command that made it, instead of leaving it to time out, and tells
   * the link the connection is gone, so it connects again at once.
   */
  override async sendToRadioFrame(frame: Uint8Array): Promise<void> {
    try {
      await this.#radioIn.writeValue(frame);
    } catch (error) {
      this.onDisconnected();
      throw error;
    }
  }

  /**
   * meshcore.js does not catch a refused write while reading the next message, which would surface
   * as an unhandled rejection: the link is already being dropped (above), so it is let go here.
   */
  override async sendCommandSyncNextMessage(): Promise<void> {
    try {
      await super.sendCommandSyncNextMessage();
    } catch {
      // The connection is gone; the read that asked for it times out with it.
    }
  }

  override close(): Promise<void> {
    if (this.#server.connected) this.#server.disconnect();
    return Promise.resolve();
  }
}

/** A link to the MeshCore radio the user picked; the same device is opened again when it drops. */
export function linkTo(device: BleDevice): MeshCoreRadio {
  return new MeshCoreRadio(() => openRadio(device));
}

/** Connects to `device`, pairs if it has not yet, and checks that the radio answers. */
export async function openRadio(device: BleDevice): Promise<OpenedRadio<CompanionConnection>> {
  const server = await connectGatt(device);
  return openOn(server, async () => {
    const service = await server.getPrimaryService(MESHCORE_SERVICE);
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
  });
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
