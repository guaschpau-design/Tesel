import { RadioError, type BleDevice } from '@tesel/radio';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openRadio } from './web-ble.ts';

/** The radio's answer to the device query: firmware version, reserved bytes, build date, model. */
const DEVICE_INFO = new Uint8Array([
  13,
  9,
  ...new Array<number>(6).fill(0),
  ...new Array<number>(12).fill(0),
  ...new TextEncoder().encode('Xiao S3 WIO'),
]);

interface Options {
  /** Whether the radio's outgoing characteristic can be read, as on ESP32 radios. */
  readable?: boolean;
  /** What reading it does: on a device not paired yet, the system asks for the PIN. */
  read?: () => Promise<DataView>;
  /** Whether the system refuses writes, as it does on a link that is not paired. */
  refuseWrites?: boolean;
  /** Whether the radio answers the device query. */
  answers?: boolean;
}

/** A radio in memory, as Web Bluetooth shows it; `log` records reads and writes in order. */
function fakeRadio(options: Options = {}): {
  device: BleDevice;
  log: string[];
  server: { disconnected: boolean };
} {
  const log: string[] = [];
  const server = { disconnected: false };
  let notify: (() => void) | null = null;
  const radioOut = {
    properties: { read: options.readable ?? true },
    value: null as DataView | null,
    readValue: () => {
      log.push('read');
      return (options.read ?? (() => Promise.resolve(new DataView(new ArrayBuffer(0)))))();
    },
    writeValue: () => Promise.reject(new Error('not writable')),
    startNotifications: () => Promise.resolve(),
    addEventListener: (_type: string, listener: () => void) => {
      notify = listener;
    },
  };
  const radioIn = {
    properties: { read: false },
    value: null,
    readValue: () => Promise.reject(new Error('not readable')),
    writeValue: (frame: Uint8Array) => {
      log.push(`write ${String(frame[0])}`);
      if (options.refuseWrites) {
        return Promise.reject(new DOMException('GATT operation not permitted', 'NotAllowedError'));
      }
      if (options.answers ?? true) {
        radioOut.value = new DataView(DEVICE_INFO.buffer);
        queueMicrotask(() => notify?.());
      }
      return Promise.resolve();
    },
    startNotifications: () => Promise.resolve(),
    addEventListener: () => undefined,
  };
  const device: BleDevice = {
    name: 'MeshCore-Radio A',
    gatt: {
      connect: () =>
        Promise.resolve({
          connected: true,
          getPrimaryService: () =>
            Promise.resolve({
              getCharacteristic: (uuid: string) =>
                Promise.resolve(uuid.startsWith('6e400002') ? radioIn : radioOut),
            }),
          disconnect: () => {
            server.disconnected = true;
          },
        }),
      disconnect: () => {
        server.disconnected = true;
      },
    },
    addEventListener: () => undefined,
  };
  return { device, log, server };
}

async function failure(promise: Promise<unknown>): Promise<RadioError> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RadioError))
    throw new Error(`expected a RadioError, got ${String(error)}`);
  return error;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('opening a radio over Web Bluetooth', () => {
  it('reads before it writes, so the system asks for the PIN, then greets the radio', async () => {
    const { device, log } = fakeRadio();
    const opened = await openRadio(device);
    expect(log).toEqual(['read', 'write 22']);
    expect(opened.name).toBe('MeshCore-Radio A');
  });

  it('tells a pairing that was cancelled or failed apart, and lets the radio go', async () => {
    const { device, server } = fakeRadio({
      read: () => Promise.reject(new DOMException('Authentication canceled', 'NetworkError')),
    });
    expect((await failure(openRadio(device))).code).toBe('not-paired');
    expect(server.disconnected).toBe(true);
  });

  it('takes a write the system refuses for a link that is not paired', async () => {
    const { device } = fakeRadio({ readable: false, refuseWrites: true });
    expect((await failure(openRadio(device))).code).toBe('not-paired');
  });

  it('drops the link at once when the system refuses a write on an open connection', async () => {
    const options: Options = {};
    const { device } = fakeRadio(options);
    const opened = await openRadio(device);
    const dropped = vi.fn();
    opened.connection.on('disconnected', dropped);
    // The radio goes out of reach: from now on the system refuses every write.
    options.refuseWrites = true;
    await expect(opened.connection.getChannel(1)).rejects.toThrow();
    // meshcore.js tells its listeners on the next turn of the event loop.
    await vi.waitFor(() => {
      expect(dropped).toHaveBeenCalledOnce();
    });
  });

  it('connects a radio whose data cannot be read without reading it', async () => {
    const { device, log } = fakeRadio({ readable: false });
    await openRadio(device);
    expect(log).toEqual(['write 22']);
  });

  it('gives up on a paired radio that never answers, as one with the wrong firmware', async () => {
    vi.useFakeTimers();
    const { device } = fakeRadio({ answers: false });
    const opening = failure(openRadio(device));
    await vi.advanceTimersByTimeAsync(5000);
    expect((await opening).code).toBe('timeout');
  });
});
