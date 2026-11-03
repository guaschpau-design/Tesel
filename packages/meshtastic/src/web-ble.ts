// Connecting to a Meshtastic radio over Web Bluetooth (ADR-0098).
//
// The radio's service has three characteristics: ToRadio takes one `ToRadio` message per write;
// FromRadio gives one `FromRadio` message per read, until it reads empty; FromNum notifies when
// there is more to read. When the radio asks for a PIN, FromRadio and ToRadio need an encrypted
// link, which only pairing gives, so FromRadio is read once before anything else, as for MeshCore:
// the first time, that read brings up the system's PIN prompt (ADR-0090). Then the radio is asked
// for its configuration (`want_config_id`) and tells its node number, channels, LoRa settings and
// the nodes it knows, ending with `config_complete_id`.

import { connectGatt, openOn, pair, type BleHold, type OpenedRadio } from '@tesel/radio';

import { BleConnection } from './ble-connection.ts';
import type { MeshtasticConnection } from './connection.ts';
import { MeshtasticRadio } from './meshtastic-radio.ts';
import { FROM_NUM, FROM_RADIO, MESHTASTIC_SERVICE, TO_RADIO } from './service.ts';

/** A link to the Meshtastic radio the user picked; the same device is opened again when it drops. */
export function linkTo(hold: BleHold): MeshtasticRadio {
  return new MeshtasticRadio(() => openRadio(hold));
}

/** Connects to the held device, pairs if it has not yet, and reads the radio's configuration. */
export async function openRadio(hold: BleHold): Promise<OpenedRadio<MeshtasticConnection>> {
  const { device } = hold;
  const server = await connectGatt(hold);
  return openOn(hold, async () => {
    const service = await server.getPrimaryService(MESHTASTIC_SERVICE);
    const toRadio = await service.getCharacteristic(TO_RADIO);
    const fromRadio = await service.getCharacteristic(FROM_RADIO);
    const fromNum = await service.getCharacteristic(FROM_NUM);
    await pair(fromRadio);
    const connection = new BleConnection(hold, toRadio, fromRadio);
    fromNum.addEventListener('characteristicvaluechanged', () => void connection.readAll());
    await fromNum.startNotifications();
    await connection.configure();
    return { connection, name: device.name ?? null, reopen: () => openRadio(hold) };
  });
}
