import { describe, expect, it } from 'vitest';

import { BleHold, type BleDevice } from './web-ble.ts';

/** A device whose Bluetooth connection counts how often it is let go. */
function device(): BleDevice & { disconnects: number } {
  const fake = {
    disconnects: 0,
    gatt: {
      connect: () =>
        Promise.resolve({ getPrimaryService: () => Promise.reject(new Error('none')) }),
      disconnect: () => {
        fake.disconnects++;
      },
    },
    addEventListener: () => undefined,
  };
  return fake;
}

describe('a hold on a radio’s Bluetooth connection', () => {
  it('lets an old link that closes late leave the connection of a newer link to the same radio', () => {
    const radio = device();
    const old = new BleHold(radio);
    const picked = new BleHold(radio);
    old.disconnect();
    expect(radio.disconnects).toBe(0);
    picked.disconnect();
    expect(radio.disconnects).toBe(1);
  });

  it('holds each radio on its own', () => {
    const first = device();
    const second = device();
    const held = new BleHold(first);
    new BleHold(second).disconnect();
    held.disconnect();
    expect([first.disconnects, second.disconnects]).toEqual([1, 1]);
  });
});
