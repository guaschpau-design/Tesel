import { describe, expect, it, vi } from 'vitest';

import { NativeBluetooth, type BleClientLike } from './native-bluetooth.ts';

const SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** A radio with one service, and what the plugin was asked. */
function fakeClient() {
  let notify: ((value: DataView) => void) | null = null;
  let dropped: (() => void) | null = null;
  const client = {
    initialize: vi.fn(() => Promise.resolve()),
    requestDevice: vi.fn(() => Promise.resolve({ deviceId: 'AA:BB', name: 'MeshCore-1' })),
    connect: vi.fn((_id: string, onDisconnect: () => void) => {
      dropped = onDisconnect;
      return Promise.resolve();
    }),
    disconnect: vi.fn(() => Promise.resolve()),
    getServices: vi.fn(() =>
      Promise.resolve([
        {
          uuid: SERVICE.toLowerCase(),
          characteristics: [
            { uuid: RX, properties: { read: false } },
            { uuid: TX, properties: { read: true } },
          ],
        },
      ]),
    ),
    read: vi.fn(() => Promise.resolve(new DataView(new Uint8Array([7]).buffer))),
    write: vi.fn<BleClientLike['write']>(() => Promise.resolve()),
    startNotifications: vi.fn(
      (
        _id: string,
        _service: string,
        _characteristic: string,
        callback: (value: DataView) => void,
      ) => {
        notify = callback;
        return Promise.resolve();
      },
    ),
  } satisfies BleClientLike;
  return {
    client,
    notify: (bytes: number[]) => notify?.(new DataView(new Uint8Array(bytes).buffer)),
    drop: () => dropped?.(),
  };
}

describe("Android's Bluetooth as Web Bluetooth", () => {
  it('picks a radio among the services of every filter, asking for Bluetooth once', async () => {
    const { client } = fakeClient();
    const bluetooth = new NativeBluetooth(client);
    const device = await bluetooth.requestDevice({
      filters: [{ services: [SERVICE] }, { services: ['x'] }],
    });
    await bluetooth.requestDevice({ filters: [{ services: [SERVICE] }] });
    expect(client.initialize).toHaveBeenCalledTimes(1);
    expect(client.requestDevice).toHaveBeenCalledWith({ services: [SERVICE, 'x'] });
    expect(device.name).toBe('MeshCore-1');
  });

  it('reads, writes and hears a characteristic, whatever the case of its UUID', async () => {
    const { client, notify } = fakeClient();
    const device = await new NativeBluetooth(client).requestDevice({
      filters: [{ services: [SERVICE] }],
    });
    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService(SERVICE);
    const rx = await service?.getCharacteristic(RX.toUpperCase());
    const tx = await service?.getCharacteristic(TX);
    await rx?.writeValue(new Uint8Array([1, 2, 3]).subarray(1));
    const written = client.write.mock.calls[0]?.[3];
    expect(
      written && [...new Uint8Array(written.buffer, written.byteOffset, written.byteLength)],
    ).toEqual([2, 3]);
    expect(tx?.properties.read).toBe(true);
    expect((await tx?.readValue())?.getUint8(0)).toBe(7);
    const heard: number[] = [];
    tx?.addEventListener('characteristicvaluechanged', () => {
      heard.push(tx.value?.getUint8(0) ?? -1);
    });
    await tx?.startNotifications();
    notify([9]);
    notify([10]);
    expect(heard).toEqual([9, 10]);
  });

  it('refuses a service the radio does not offer, and tells each link of a drop once', async () => {
    const { client, drop } = fakeClient();
    const device = await new NativeBluetooth(client).requestDevice({
      filters: [{ services: [SERVICE] }],
    });
    const server = await device.gatt?.connect();
    await expect(
      server?.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb'),
    ).rejects.toThrow();
    const dropped = vi.fn();
    device.addEventListener('gattserverdisconnected', dropped, { once: true });
    drop();
    drop();
    expect(dropped).toHaveBeenCalledTimes(1);
    device.gatt?.disconnect();
    expect(client.disconnect).toHaveBeenCalledWith('AA:BB');
  });
});
