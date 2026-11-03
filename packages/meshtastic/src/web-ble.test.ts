import { RadioError, type BleDevice } from '@tesel/radio';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Incoming } from './connection.ts';
import { ProtoMessage, ProtoWriter } from './protobuf.ts';
import { CHANNEL, CHANNEL_SETTINGS, FROM_RADIO, MESH_PACKET, TO_RADIO } from './schema.ts';
import { FROM_NUM, FROM_RADIO as FROM_RADIO_UUID, TO_RADIO as TO_RADIO_UUID } from './service.ts';
import { openRadio } from './web-ble.ts';

const ME = 0xa1b2c3d4;

interface Options {
  /** Whether FromRadio can be read, as on every Meshtastic radio. */
  readable?: boolean;
  /** What the first read does: on a device not paired yet, the system asks for the PIN. */
  pairingRead?: () => Promise<DataView>;
  /** Whether the system refuses writes, as it does on a link that is not paired. */
  refuseWrites?: boolean;
  /** Whether the radio answers when asked for its configuration. */
  answers?: boolean;
  /** How long each read of FromRadio takes. */
  readMs?: number;
  /** What the radio says of each packet it is handed: 0 takes it. */
  queueResult?: number;
}

/** A Meshtastic radio in memory, as Web Bluetooth shows it; `log` records reads and writes. */
function fakeRadio(options: Options = {}) {
  const log: string[] = [];
  const server = { disconnected: false };
  const outbox: Uint8Array[] = [];
  let notify: (() => void) | null = null;
  let disconnected: (() => void) | null = null;
  let pairingRead = true;

  const say = (message: ProtoWriter) => {
    outbox.push(message.finish());
    queueMicrotask(() => notify?.());
  };
  const answer = (written: Uint8Array) => {
    const parsed = ProtoMessage.parse(written);
    if (!parsed.ok) throw new Error(parsed.error);
    const nonce = parsed.value.uint32(TO_RADIO.wantConfigId);
    if (nonce !== undefined) {
      if (options.answers === false) return;
      const myInfo = new ProtoWriter().varint(1, ME);
      say(new ProtoWriter().message(FROM_RADIO.myInfo, myInfo));
      const settings = new ProtoWriter()
        .bytes(CHANNEL_SETTINGS.psk, new Uint8Array(16).fill(9))
        .string(CHANNEL_SETTINGS.name, 'Rescate');
      const channel = new ProtoWriter()
        .varint(CHANNEL.index, 1)
        .message(CHANNEL.settings, settings)
        .varint(CHANNEL.role, 2);
      say(new ProtoWriter().message(FROM_RADIO.channel, channel));
      const lora = new ProtoWriter().varint(1, 1).varint(2, 4).varint(8, 5);
      say(new ProtoWriter().message(FROM_RADIO.config, new ProtoWriter().message(6, lora)));
      const user = new ProtoWriter().string(2, 'Marta');
      const node = new ProtoWriter().varint(1, 0x0badcafe).message(2, user);
      say(new ProtoWriter().message(FROM_RADIO.nodeInfo, node));
      say(new ProtoWriter().varint(FROM_RADIO.configCompleteId, nonce));
      return;
    }
    const id = parsed.value.message(TO_RADIO.packet)?.fixed32(MESH_PACKET.id) ?? 0;
    const status = new ProtoWriter().varint(4, id);
    if (options.queueResult !== undefined) status.varint(1, options.queueResult);
    say(new ProtoWriter().message(FROM_RADIO.queueStatus, status));
  };

  const empty = () => new DataView(new ArrayBuffer(0));
  const fromRadio = {
    properties: { read: options.readable ?? true },
    value: null,
    readValue: async (): Promise<DataView> => {
      log.push('read');
      if (pairingRead) {
        pairingRead = false;
        return (options.pairingRead ?? (() => Promise.resolve(empty())))();
      }
      if (options.readMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.readMs));
      }
      const next = outbox.shift();
      return next === undefined ? empty() : new DataView(next.buffer);
    },
    writeValue: () => Promise.reject(new Error('not writable')),
    startNotifications: () => Promise.resolve(),
    addEventListener: () => undefined,
  };
  const toRadio = {
    properties: { read: false },
    value: null,
    readValue: () => Promise.reject(new Error('not readable')),
    writeValue: (written: Uint8Array) => {
      log.push('write');
      if (options.refuseWrites) {
        return Promise.reject(new DOMException('GATT operation not permitted', 'NotAllowedError'));
      }
      answer(written);
      return Promise.resolve();
    },
    startNotifications: () => Promise.resolve(),
    addEventListener: () => undefined,
  };
  const fromNum = {
    ...toRadio,
    addEventListener: (_type: string, listener: () => void) => {
      notify = listener;
    },
  };
  const characteristics = new Map<string, unknown>([
    [TO_RADIO_UUID, toRadio],
    [FROM_RADIO_UUID, fromRadio],
    [FROM_NUM, fromNum],
  ]);
  const disconnect = () => {
    server.disconnected = true;
  };
  const device = {
    name: 'Meshtastic_c3d4',
    gatt: {
      connect: () =>
        Promise.resolve({
          connected: true,
          getPrimaryService: () =>
            Promise.resolve({
              getCharacteristic: (uuid: string) => Promise.resolve(characteristics.get(uuid)),
            }),
          disconnect,
        }),
      disconnect,
    },
    addEventListener: (_type: string, listener: () => void) => {
      disconnected = listener;
    },
  } as BleDevice;
  return {
    device,
    log,
    server,
    options,
    /** The radio hears a packet from another node. */
    hear: (packet: ProtoWriter) => {
      say(new ProtoWriter().message(FROM_RADIO.packet, packet));
    },
    /** Bluetooth drops. */
    drop: () => disconnected?.(),
  };
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

describe('opening a Meshtastic radio over Web Bluetooth', () => {
  it('reads before it writes, so the system asks for the PIN, then learns the radio', async () => {
    const { device, log } = fakeRadio();
    const opened = await openRadio(device);
    expect(log.slice(0, 2)).toEqual(['read', 'write']);
    expect(opened.name).toBe('Meshtastic_c3d4');
    const { setup } = opened.connection;
    expect(setup.myNodeNum).toBe(ME);
    expect(setup.channels).toEqual([
      { index: 1, role: 'secondary', psk: new Uint8Array(16).fill(9), name: 'Rescate' },
    ]);
    expect(setup.lora).toMatchObject({ usePreset: true, modemPreset: 4, hopLimit: 5 });
    expect(setup.nodes).toMatchObject([{ num: 0x0badcafe, user: { longName: 'Marta' } }]);
  });

  it('tells a pairing that was cancelled or failed apart, and lets the radio go', async () => {
    const { device, server } = fakeRadio({
      pairingRead: () =>
        Promise.reject(new DOMException('Authentication canceled', 'NetworkError')),
    });
    expect((await failure(openRadio(device))).code).toBe('not-paired');
    expect(server.disconnected).toBe(true);
  });

  it('takes a write the system refuses for a link that is not paired', async () => {
    const { device } = fakeRadio({ readable: false, refuseWrites: true });
    expect((await failure(openRadio(device))).code).toBe('not-paired');
  });

  it('gives up on a paired radio that never tells its configuration', async () => {
    vi.useFakeTimers();
    const { device, server } = fakeRadio({ answers: false });
    const opening = failure(openRadio(device));
    await vi.advanceTimersByTimeAsync(5000);
    expect((await opening).code).toBe('timeout');
    expect(server.disconnected).toBe(true);
  });

  it('waits for a slow radio as long as it keeps telling', async () => {
    vi.useFakeTimers();
    const { device } = fakeRadio({ readMs: 3000 });
    const opening = openRadio(device);
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await opening).connection.setup.myNodeNum).toBe(ME);
  });
});

describe('an open Meshtastic connection', () => {
  const packet = {
    to: 0xffffffff,
    channel: 1,
    hopLimit: 3,
    portnum: 256,
    payload: new Uint8Array([1]),
  };

  it('resolves a packet once the radio has taken it, and refuses one it did not', async () => {
    const radio = fakeRadio();
    const { connection } = await openRadio(radio.device);
    await expect(connection.sendPacket(packet)).resolves.toBeUndefined();
    radio.options.queueResult = 32;
    await expect(connection.sendPacket(packet)).rejects.toMatchObject({ code: 'refused' });
  });

  it('hands on what the radio hears, what it heard before anyone listened first', async () => {
    const radio = fakeRadio();
    const { connection } = await openRadio(radio.device);
    const data = new ProtoWriter().varint(1, 256).bytes(2, new Uint8Array([7]));
    radio.hear(new ProtoWriter().fixed32(MESH_PACKET.from, 5).message(MESH_PACKET.decoded, data));
    await vi.waitFor(() => {
      expect(radio.log.at(-1)).toBe('read');
    });
    const heard: Incoming[] = [];
    connection.onIncoming((incoming) => heard.push(incoming));
    await vi.waitFor(() => {
      expect(heard).toMatchObject([
        { kind: 'packet', packet: { from: 5, payload: new Uint8Array([7]) } },
      ]);
    });
  });

  it('keeps the link when a listener of the app fails', async () => {
    const radio = fakeRadio();
    const { connection } = await openRadio(radio.device);
    const dropped = vi.fn();
    connection.onDisconnected(dropped);
    const failed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const heard: Incoming[] = [];
    connection.onIncoming(() => {
      throw new Error('the app failed');
    });
    connection.onIncoming((incoming) => heard.push(incoming));
    const data = new ProtoWriter().varint(1, 256).bytes(2, new Uint8Array([7]));
    radio.hear(new ProtoWriter().fixed32(MESH_PACKET.from, 5).message(MESH_PACKET.decoded, data));
    radio.hear(new ProtoWriter().fixed32(MESH_PACKET.from, 6).message(MESH_PACKET.decoded, data));
    await vi.waitFor(() => {
      expect(heard).toHaveLength(2);
    });
    expect(dropped).not.toHaveBeenCalled();
    expect(radio.server.disconnected).toBe(false);
    expect(failed).toHaveBeenCalledTimes(2);
    failed.mockRestore();
  });

  it('says it dropped when Bluetooth goes, or when the system refuses a write', async () => {
    const first = fakeRadio();
    const dropped = vi.fn();
    (await openRadio(first.device)).connection.onDisconnected(dropped);
    first.drop();
    expect(dropped).toHaveBeenCalledOnce();

    const second = fakeRadio();
    const { connection } = await openRadio(second.device);
    connection.onDisconnected(dropped);
    second.options.refuseWrites = true;
    await expect(connection.sendPacket(packet)).rejects.toThrow();
    expect(dropped).toHaveBeenCalledTimes(2);
    expect(second.server.disconnected).toBe(true);
  });
});
