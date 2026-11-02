import { MESHCORE_DATA_TYPE } from '@tesel/protocol';
import { RadioError, type OpenedRadio, type ReceivedFrame } from '@tesel/radio';
import { describe, expect, it, vi } from 'vitest';

import { chooseChannelSlot } from './channel-slot.ts';
import {
  PUSH_MSG_WAITING,
  type ChannelInfo,
  type CompanionConnection,
  type SyncedMessage,
} from './companion.ts';
import { MeshCoreRadio } from './meshcore-radio.ts';

const SECRET = new Uint8Array(16).fill(9);
const EMPTY = new Uint8Array(16);

/** A radio in memory: channel slots, a message queue and a log of what was sent. */
class FakeCompanion implements CompanionConnection {
  readonly listeners = new Map<string | number, Set<(...args: unknown[]) => void>>();
  readonly sent: { channel: number; pathLen: number; dataType: number; payload: Uint8Array }[] = [];
  readonly waiting: SyncedMessage[] = [];
  closed = false;

  channels: ChannelInfo[];

  constructor(channels: ChannelInfo[]) {
    this.channels = channels;
  }

  on(event: string | number, listener: (...args: unknown[]) => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: string | number, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string | number): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }

  getChannel(index: number): Promise<ChannelInfo> {
    const channel = this.channels[index];
    // meshcore.js rejects with no reason when the radio answers ERR; the fake does the same.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return channel ? Promise.resolve(channel) : Promise.reject();
  }

  setChannel(index: number, name: string, secret: Uint8Array): Promise<void> {
    this.channels[index] = { channelIdx: index, name, secret };
    return Promise.resolve();
  }

  sendChannelData(
    channel: number,
    pathLen: number,
    _path: Uint8Array,
    dataType: number,
    payload: Uint8Array,
  ): Promise<unknown> {
    this.sent.push({ channel, pathLen, dataType, payload });
    return Promise.resolve({});
  }

  syncNextMessage(): Promise<SyncedMessage> {
    return Promise.resolve(this.waiting.shift() ?? null);
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

const slots = (...entries: [string, Uint8Array][]): ChannelInfo[] =>
  entries.map(([name, secret], channelIdx) => ({ channelIdx, name, secret }));

/** Opens `fakes` in turn: the first on connecting, the next ones each time the link reopens. */
function opener(fakes: FakeCompanion[]): () => Promise<OpenedRadio<CompanionConnection>> {
  const open = (): Promise<OpenedRadio<CompanionConnection>> => {
    const fake = fakes.shift();
    if (fake === undefined) return Promise.reject(new Error('radio out of range'));
    return Promise.resolve({ connection: fake, name: 'MeshCore-T1000', reopen: open });
  };
  return open;
}

async function connected(...fakes: FakeCompanion[]): Promise<MeshCoreRadio> {
  const radio = new MeshCoreRadio(opener(fakes));
  await radio.connect();
  return radio;
}

describe('channel slots', () => {
  it('reuses the slot that already holds the group secret', () => {
    const channels = slots(['Public', EMPTY], ['', EMPTY], ['Rescate', SECRET]);
    expect(chooseChannelSlot(channels, SECRET)).toEqual({ kind: 'reuse', index: 2 });
  });

  it('takes the first empty slot, never the public one or someone else’s', () => {
    const channels = slots(['Public', EMPTY], ['Amigos', new Uint8Array(16).fill(1)], ['', EMPTY]);
    expect(chooseChannelSlot(channels, SECRET)).toEqual({ kind: 'empty', index: 2 });
    expect(chooseChannelSlot(channels.slice(0, 2), SECRET)).toEqual({ kind: 'full' });
  });
});

describe('MeshCore radio', () => {
  it('stores the group secret in a free slot and floods events with Tesel’s data type', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    const radio = await connected(fake);
    expect(radio.state).toBe('ready');
    expect(radio.name).toBe('MeshCore-T1000');
    await radio.configureGroupChannel('Rescate Valencia', SECRET);
    expect(fake.channels[1]).toEqual({ channelIdx: 1, name: 'Rescate Valencia', secret: SECRET });

    const bytes = new Uint8Array([1, 2, 3]);
    expect(await radio.send(bytes)).toEqual({ status: 'sent' });
    expect(fake.sent).toEqual([
      { channel: 1, pathLen: 0xff, dataType: MESHCORE_DATA_TYPE, payload: bytes },
    ]);
  });

  it('refuses to take over a radio whose channel slots are all in use', async () => {
    const fake = new FakeCompanion(
      slots(['Public', EMPTY], ['Amigos', new Uint8Array(16).fill(1)]),
    );
    const radio = await connected(fake);
    await expect(radio.configureGroupChannel('Rescate', SECRET)).rejects.toBeInstanceOf(RadioError);
    expect(await radio.send(new Uint8Array([1]))).toMatchObject({ status: 'failed' });
  });

  it('passes on Tesel datagrams of channels with a secret, each with its secret', async () => {
    const other = new Uint8Array(16).fill(4);
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['Rescate', SECRET], ['Antes', other]));
    const radio = await connected(fake);
    const frames: ReceivedFrame[] = [];
    radio.onReceive((frame) => frames.push(frame));
    await radio.configureGroupChannel('Rescate', SECRET);

    const ours = new Uint8Array([7, 7]);
    fake.waiting.push(
      { channelMessage: { channelIdx: 0, senderTimestamp: 1, text: 'Marta: hola' } },
      {
        channelData: {
          channelIdx: 0,
          dataType: MESHCORE_DATA_TYPE,
          data: new Uint8Array([1]),
          snr: 5,
        },
      },
      { channelData: { channelIdx: 1, dataType: 0x1234, data: new Uint8Array([2]), snr: 5 } },
      { channelData: { channelIdx: 1, dataType: MESHCORE_DATA_TYPE, data: ours, snr: 6.25 } },
      { channelData: { channelIdx: 2, dataType: MESHCORE_DATA_TYPE, data: ours, snr: 1 } },
    );
    fake.emit(PUSH_MSG_WAITING);
    await vi.waitFor(() => {
      expect(frames).toEqual([
        { bytes: ours, snr: 6.25, secret: SECRET },
        { bytes: ours, snr: 1, secret: other },
      ]);
    });
    expect(fake.waiting).toEqual([]);
  });

  it('keeps the text messages of other MeshCore apps instead of losing them', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['Rescate', SECRET]));
    const radio = await connected(fake);
    const texts: unknown[] = [];
    radio.onText((text) => texts.push(text));
    await radio.configureGroupChannel('Rescate', SECRET);
    fake.waiting.push(
      {
        channelMessage: {
          channelIdx: 0,
          senderTimestamp: 100,
          text: 'Marta: ¿Alguien en Benimaclet?',
        },
      },
      {
        contactMessage: {
          pubKeyPrefix: new Uint8Array([0xab, 0xcd, 1, 2, 3, 4]),
          senderTimestamp: 101,
          text: 'Hola',
        },
      },
    );
    fake.emit(PUSH_MSG_WAITING);
    await vi.waitFor(() => {
      expect(texts).toEqual([
        {
          kind: 'channel',
          channel: 'Public',
          sender: 'Marta',
          text: '¿Alguien en Benimaclet?',
          time: 100,
        },
        { kind: 'direct', channel: null, sender: 'abcd01020304', text: 'Hola', time: 101 },
      ]);
    });
  });

  it('reconnects to the same radio by itself when the Bluetooth link drops', async () => {
    vi.useFakeTimers();
    const first = new FakeCompanion(slots(['Public', EMPTY]));
    const again = new FakeCompanion(slots(['Public', EMPTY]));
    const radio = await connected(first, again);
    const states: string[] = [];
    radio.onStateChange((state) => states.push(state));
    first.emit('disconnected');
    expect(radio.state).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(radio.state).toBe('ready');
    // Straight to reconnecting: the app keeps the radio for its group meanwhile.
    expect(states).toEqual(['connecting', 'ready']);
    vi.useRealTimers();
  });

  it('keeps trying with growing pauses while the radio is out of reach, until disconnected', async () => {
    vi.useFakeTimers();
    const fake = new FakeCompanion(slots(['Public', EMPTY]));
    const radio = await connected(fake);
    fake.emit('disconnected');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(radio.state).toBe('connecting');
    await radio.disconnect();
    expect(radio.state).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(radio.state).toBe('disconnected');
    vi.useRealTimers();
  });

  it('clears the channel slot of a group that was left', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['Rescate', SECRET]));
    const radio = await connected(fake);
    await radio.forgetChannels((secret) => secret.every((byte) => byte === 9));
    expect(fake.channels[1]).toEqual({ channelIdx: 1, name: '', secret: EMPTY });
  });

  it('gives up on a command the radio never answers, and on the radio itself', async () => {
    vi.useFakeTimers();
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    fake.sendChannelData = () => new Promise(() => undefined);
    const radio = await connected(fake);
    await radio.configureGroupChannel('Rescate', SECRET);
    const outcome = radio.send(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(await outcome).toMatchObject({ status: 'failed', reason: 'the radio did not answer' });
    // A late answer could be taken for the next command's: the link starts again, clean.
    await vi.advanceTimersByTimeAsync(0);
    expect(radio.state).toBe('connecting');
    expect(fake.closed).toBe(true);
    await radio.disconnect();
    vi.useRealTimers();
  });

  it('keeps a new connection when a command left on the dropped one times out later', async () => {
    vi.useFakeTimers();
    const first = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    const again = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    const radio = await connected(first, again);
    await radio.configureGroupChannel('Rescate', SECRET);
    first.sendChannelData = () => new Promise(() => undefined);
    const stuck = radio.send(new Uint8Array([1]));
    // The link drops with the send in flight, and the radio is back a second later.
    first.emit('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(radio.state).toBe('ready');
    // The send on the old connection times out: the new one stays.
    await vi.advanceTimersByTimeAsync(5000);
    expect(await stuck).toMatchObject({ status: 'failed' });
    expect(radio.state).toBe('ready');
    expect(again.closed).toBe(false);
    await radio.disconnect();
    vi.useRealTimers();
  });

  it('lets go of a radio that finishes opening after the user disconnected', async () => {
    let finish: (opened: OpenedRadio<CompanionConnection>) => void = () => undefined;
    const fake = new FakeCompanion(slots(['Public', EMPTY]));
    const radio = new MeshCoreRadio(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const connecting = radio.connect();
    await radio.disconnect();
    finish({ connection: fake, name: 'MeshCore-T1000', reopen: () => Promise.reject(new Error()) });
    await connecting;
    expect(radio.state).toBe('disconnected');
    expect(fake.closed).toBe(true);
  });
});
