// What every kind of radio shares over Web Bluetooth (Chrome and Edge; Bluefy on the iPhone):
// the part of the API Tesel uses, picking a radio of any kind Tesel speaks, pairing, time limits
// that turn a silent radio into a failure the user is told about (ADR-0090), and a link's hold on
// its radio's Bluetooth connection, which the browser shares between every link made to it.

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

/** A device's connected Bluetooth services; the connection itself is let go by `BleHold`. */
export interface BleServer {
  getPrimaryService(uuid: string): Promise<{
    getCharacteristic(uuid: string): Promise<BleCharacteristic>;
  }>;
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

/** The hold on each device made last: the only one that may disconnect it. */
const newestHolds = new WeakMap<BleDevice, BleHold>();

/**
 * A link's hold on a radio's Bluetooth connection. The browser gives one connection per device and
 * one object for it, shared by every link made to the device: an old link that lets a connection
 * go late, as when an attempt to open it again ends after the user picked the same radio anew,
 * must not close it under the new link. So only the hold made last disconnects the device.
 */
export class BleHold {
  readonly device: BleDevice;

  constructor(device: BleDevice) {
    this.device = device;
    newestHolds.set(device, this);
  }

  /** Disconnects the device's Bluetooth, unless a link made later holds it. */
  disconnect(): void {
    if (newestHolds.get(this.device) === this) this.device.gatt?.disconnect();
  }
}

/** How long the radio has to accept the Bluetooth connection. */
const CONNECT_MS = 15_000;
/** How long the user has to type the PIN when the system asks for it. */
const PAIRING_MS = 60_000;
/**
 * How long a radio has to open once its Bluetooth connection is made: finding its service and
 * characteristics, the PIN typed, and the first answers. Generous, as it covers all of them.
 */
const OPEN_MS = 120_000;

/**
 * Shows the browser's Bluetooth picker with every radio that offers one of `services`, one per
 * kind of radio, and says which one the picked radio offers, with the new link's hold on it. The
 * browser does not say which filter a device matched, so the radio is connected to look.
 */
export async function pickRadio<Service extends string>(
  services: readonly Service[],
): Promise<{ readonly hold: BleHold; readonly service: Service }> {
  const { bluetooth } = navigator as Navigator & { readonly bluetooth: Bluetooth };
  const device = await bluetooth.requestDevice({
    filters: services.map((service) => ({ services: [service] })),
  });
  const hold = new BleHold(device);
  const server = await connectGatt(hold);
  for (const service of services) {
    try {
      await server.getPrimaryService(service);
      // Left connected: the radio's own code opens this same connection.
      return { hold, service };
    } catch {
      // Not this kind of radio: try the next one.
    }
  }
  hold.disconnect();
  throw new RadioError('refused', 'the radio offers no service Tesel speaks');
}

/** Connects to the device's Bluetooth services, or gives up after a while. */
export async function connectGatt(hold: BleHold): Promise<BleServer> {
  const { gatt } = hold.device;
  if (gatt === undefined) throw new Error('the device offers no Bluetooth services');
  return within(gatt.connect(), CONNECT_MS, 'the radio did not connect').catch((error: unknown) => {
    // A connection that completes after the limit must not keep holding the radio.
    hold.disconnect();
    throw error;
  });
}

/**
 * Opens a radio on its Bluetooth connection with `open`, or lets the connection go. A step the
 * browser never finishes (finding the service, turning notifications on) fails after a while, so
 * a radio being opened again after a drop cannot keep its link waiting forever.
 */
export async function openOn<Opened>(hold: BleHold, open: () => Promise<Opened>): Promise<Opened> {
  try {
    return await within(open(), OPEN_MS, 'the radio did not finish opening');
  } catch (error) {
    hold.disconnect();
    throw error;
  }
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
