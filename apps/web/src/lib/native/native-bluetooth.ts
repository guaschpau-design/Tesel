// The part of Web Bluetooth the radios use (packages/radio/src/web-ble.ts), over Android's own
// Bluetooth (@capacitor-community/bluetooth-le, ADR-0125): an Android web view has no Web
// Bluetooth, and a connection the app holds itself stays up with the screen off. MeshCore and
// Meshtastic links run on it unchanged.

import type { BleCharacteristic, BleDevice, BleServer } from '@tesel/radio';

/** What is used of the plugin's client. */
export interface BleClientLike {
  initialize(options: { androidNeverForLocation: boolean }): Promise<void>;
  requestDevice(options: {
    services: string[];
  }): Promise<{ readonly deviceId: string; readonly name?: string }>;
  connect(deviceId: string, onDisconnect: (deviceId: string) => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getServices(deviceId: string): Promise<
    readonly {
      readonly uuid: string;
      readonly characteristics: readonly {
        readonly uuid: string;
        readonly properties: { readonly read: boolean };
      }[];
    }[]
  >;
  read(deviceId: string, service: string, characteristic: string): Promise<DataView>;
  write(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void,
  ): Promise<void>;
}

/** Bluetooth's requestDevice, as the radio picker calls it, over the plugin. */
export class NativeBluetooth {
  readonly #client: BleClientLike;
  #ready: Promise<void> | null = null;

  constructor(client: BleClientLike) {
    this.#client = client;
  }

  /**
   * Android's list of radios that offer one of the services of `filters`. Bluetooth is asked for
   * the first time a radio is picked: the scan does not tell where the device is, so the location
   * is not needed for it.
   */
  async requestDevice(options: {
    readonly filters: readonly { readonly services: readonly string[] }[];
  }): Promise<BleDevice> {
    this.#ready ??= this.#client.initialize({ androidNeverForLocation: true });
    await this.#ready.catch((reason: unknown) => {
      this.#ready = null;
      throw reason;
    });
    const services = options.filters.flatMap((filter) => filter.services);
    const { deviceId, name } = await this.#client.requestDevice({ services });
    return new NativeDevice(this.#client, deviceId, name);
  }
}

class NativeDevice implements BleDevice {
  readonly name?: string;
  readonly gatt: NonNullable<BleDevice['gatt']>;
  readonly #onDisconnect: (() => void)[] = [];

  constructor(client: BleClientLike, deviceId: string, name: string | undefined) {
    if (name !== undefined) this.name = name;
    this.gatt = {
      connect: async () => {
        await client.connect(deviceId, () => {
          for (const listener of this.#onDisconnect.splice(0)) listener();
        });
        return new NativeServer(client, deviceId);
      },
      disconnect: () => {
        client.disconnect(deviceId).catch((reason: unknown) => {
          console.warn('Disconnecting the radio failed', reason);
        });
      },
    };
  }

  /** Listeners last one disconnection, as each link adds its own with `once`. */
  addEventListener(_type: 'gattserverdisconnected', listener: () => void): void {
    this.#onDisconnect.push(listener);
  }
}

class NativeServer implements BleServer {
  readonly #client: BleClientLike;
  readonly #deviceId: string;

  constructor(client: BleClientLike, deviceId: string) {
    this.#client = client;
    this.#deviceId = deviceId;
  }

  async getPrimaryService(uuid: string): Promise<{
    getCharacteristic(uuid: string): Promise<BleCharacteristic>;
  }> {
    const services = await this.#client.getServices(this.#deviceId);
    const service = services.find((found) => sameUuid(found.uuid, uuid));
    if (service === undefined) throw new Error(`the radio offers no service ${uuid}`);
    return {
      getCharacteristic: (characteristicUuid) => {
        const found = service.characteristics.find((characteristic) =>
          sameUuid(characteristic.uuid, characteristicUuid),
        );
        if (found === undefined) {
          return Promise.reject(
            new Error(`the radio offers no characteristic ${characteristicUuid}`),
          );
        }
        const address = { deviceId: this.#deviceId, service: service.uuid, uuid: found.uuid };
        return Promise.resolve(new NativeCharacteristic(this.#client, address, found.properties));
      },
    };
  }
}

interface Address {
  readonly deviceId: string;
  readonly service: string;
  readonly uuid: string;
}

class NativeCharacteristic implements BleCharacteristic {
  readonly properties: { readonly read: boolean };
  value: DataView | null = null;
  readonly #client: BleClientLike;
  readonly #address: Address;
  readonly #listeners: (() => void)[] = [];

  constructor(client: BleClientLike, address: Address, properties: { readonly read: boolean }) {
    this.#client = client;
    this.#address = address;
    this.properties = { read: properties.read };
  }

  async readValue(): Promise<DataView> {
    const { deviceId, service, uuid } = this.#address;
    this.value = await this.#client.read(deviceId, service, uuid);
    return this.value;
  }

  async writeValue(value: Uint8Array): Promise<void> {
    const { deviceId, service, uuid } = this.#address;
    await this.#client.write(
      deviceId,
      service,
      uuid,
      new DataView(value.buffer, value.byteOffset, value.byteLength),
    );
  }

  async startNotifications(): Promise<void> {
    const { deviceId, service, uuid } = this.#address;
    await this.#client.startNotifications(deviceId, service, uuid, (value) => {
      this.value = value;
      for (const listener of this.#listeners) listener();
    });
  }

  addEventListener(_type: 'characteristicvaluechanged', listener: () => void): void {
    this.#listeners.push(listener);
  }
}

/** UUIDs as the radios' code writes them and as Android gives them back. */
function sameUuid(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
