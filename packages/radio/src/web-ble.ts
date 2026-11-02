// What every kind of radio shares over Web Bluetooth (Chrome and Edge; Bluefy on the iPhone):
// the part of the API Tesel uses, picking a radio of any kind Tesel speaks, pairing, and time
// limits that turn a silent radio into a failure the user is told about (ADR-0090).

import { RadioError } from './radio-link.ts';
import { within } from './time-limit.ts';

/** The part of Web Bluetooth used here: it is not in TypeScript's DOM library. */
export interface BleCharacteristic {
  readonly properties: { readonly read: boolean };
  readonly value: DataView | null;
  readValue(): Promise<DataView>;
  /** Written with response, the only way radios take their incoming characteristic. */
  writeValue(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<unknown>;
  addEventListener(type: 'characteristicvaluechanged', listener: () => void): void;
}

export interface BleServer {
  readonly connected: boolean;
  getPrimaryService(uuid: string): Promise<{
    getCharacteristic(uuid: string): Promise<BleCharacteristic>;
  }>;
  disconnect(): void;
}

export interface BleDevice {
  readonly name?: string;
  readonly gatt?: { connect(): Promise<BleServer>; disconnect(): void };
  addEventListener(
    type: 'gattserverdisconnected',
    listener: () => void,
    options: { once: true },
  ): void;
}

interface Bluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<BleDevice>;
}

/** How long the radio has to accept the Bluetooth connection. */
const CONNECT_MS = 15_000;
/** How long the user has to type the PIN when the system asks for it. */
const PAIRING_MS = 60_000;

/**
 * Shows the browser's Bluetooth picker with every radio that offers one of `services`, one per
 * kind of radio, and says which one the picked radio offers. The browser does not say which
 * filter a device matched, so the radio is connected to look.
 */
export async function pickRadio<Service extends string>(
  services: readonly Service[],
): Promise<{ readonly device: BleDevice; readonly service: Service }> {
  const { bluetooth } = navigator as Navigator & { readonly bluetooth: Bluetooth };
  const device = await bluetooth.requestDevice({
    filters: services.map((service) => ({ services: [service] })),
  });
  const server = await connectGatt(device);
  for (const service of services) {
    try {
      await server.getPrimaryService(service);
      // Left connected: the radio's own code opens this same connection.
      return { device, service };
    } catch {
      // Not this kind of radio: try the next one.
    }
  }
  server.disconnect();
  throw new RadioError('refused', 'the radio offers no service Tesel speaks');
}

/** Connects to the device's Bluetooth services, or gives up after a while. */
export async function connectGatt(device: BleDevice): Promise<BleServer> {
  const { gatt } = device;
  if (gatt === undefined) throw new Error('the device offers no Bluetooth services');
  return within(gatt.connect(), CONNECT_MS, 'the radio did not connect').catch((error: unknown) => {
    // A connection that completes after the limit must not keep holding the radio.
    gatt.disconnect();
    throw error;
  });
}

/**
 * Reads a characteristic that needs the PIN: the first time, this is what makes the system ask
 * for it; once paired, it answers at once. Without it some systems (Chrome on Android) never ask,
 * and the radio silently refuses every command. A radio whose characteristic cannot be read is
 * paired by the system on the first write instead.
 */
export async function pair(protectedCharacteristic: BleCharacteristic): Promise<void> {
  if (!protectedCharacteristic.properties.read) return;
  try {
    await within(protectedCharacteristic.readValue(), PAIRING_MS, 'no PIN was given');
  } catch (error) {
    throw new RadioError('not-paired', `pairing failed: ${messageOf(error)}`);
  }
}

/** The bytes of a characteristic's value, copied: the browser may reuse its buffer. */
export function copyOf(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'no reason given';
}
