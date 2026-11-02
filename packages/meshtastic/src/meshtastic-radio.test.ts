import { MESHTASTIC_PORTNUM } from '@tesel/protocol';
import { RadioError, type OpenedRadio, type RadioText, type ReceivedFrame } from '@tesel/radio';
import { describe, expect, it, vi } from 'vitest';

import type { Incoming, MeshtasticConnection, RadioSetup } from './connection.ts';
import type { MeshPacket } from './from-radio.ts';
import { MeshtasticRadio } from './meshtastic-radio.ts';
import type { MeshtasticNode } from './nodes.ts';
import { ProtoWriter } from './protobuf.ts';
import { BROADCAST, PORT } from './schema.ts';
import { setChannel, type ChannelEntry, type OutgoingPacket } from './to-radio.ts';

const ME = 0xa1b2c3d4;
const MARTA = 0x0badcafe;
const SECRET = new Uint8Array(16).fill(9);
const OTHER = new Uint8Array(16).fill(4);

type Sent = Omit<OutgoingPacket, 'id'>;

/** The radio's eight channels: a primary, then the secondaries given, then disabled ones. */
function channels(...secondaries: [string, Uint8Array][]): ChannelEntry[] {
  return Array.from({ length: 8 }, (_, index): ChannelEntry => {
    if (index === 0) return { index, role: 'primary', psk: new Uint8Array([1]), name: '' };
    const secondary = secondaries[index - 1];
    if (secondary === undefined) {
      return { index, role: 'disabled', psk: new Uint8Array(0), name: '' };
    }
    return { index, role: 'secondary', psk: secondary[1], name: secondary[0] };
  });
}

/** A radio in memory: what it told when it connected, and a log of what it was handed. */
class FakeRadio implements MeshtasticConnection {
  readonly sent: Sent[] = [];
  readonly #incoming = new Set<(incoming: Incoming) => void>();
  readonly #dropped = new Set<() => void>();
  closed = false;
  /** How the radio answers a packet; it takes every one unless a test says otherwise. */
  take: (packet: Sent) => Promise<void> = () => Promise.resolve();

  readonly setup: RadioSetup;

  constructor(setup: Partial<RadioSetup> = {}) {
    this.setup = { myNodeNum: ME, channels: channels(), lora: null, nodes: [], ...setup };
  }

  sendPacket(packet: Sent): Promise<void> {
    this.sent.push(packet);
    return this.take(packet);
  }

  onIncoming(listener: (incoming: Incoming) => void): () => void {
    this.#incoming.add(listener);
    return () => this.#incoming.delete(listener);
  }

  onDisconnected(listener: () => void): () => void {
    this.#dropped.add(listener);
    return () => this.#dropped.delete(listener);
  }

  hear(packet: Partial<MeshPacket>): void {
    const full: MeshPacket = {
      from: MARTA,
      to: BROADCAST,
      channel: 0,
      portnum: MESHTASTIC_PORTNUM,
      payload: new Uint8Array(0),
      rxTime: 1_800_000_000,
      rxSnr: 5,
      ...packet,
    };
    for (const listener of this.#incoming) listener({ kind: 'packet', packet: full });
  }

  drop(): void {
    for (const listener of this.#dropped) listener();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

/** Opens `radios` in turn: the first on connecting, the next ones each time the link reopens. */
function opener(radios: FakeRadio[]): () => Promise<OpenedRadio<MeshtasticConnection>> {
  const open = (): Promise<OpenedRadio<MeshtasticConnection>> => {
    const radio = radios.shift();
    if (radio === undefined) return Promise.reject(new Error('radio out of range'));
    return Promise.resolve({ connection: radio, name: 'Meshtastic_c3d4', reopen: open });
  };
  return open;
}

async function connected(...radios: FakeRadio[]): Promise<MeshtasticRadio> {
  const link = new MeshtasticRadio(opener(radios));
  await link.connect();
  return link;
}

describe('Meshtastic radio', () => {
  it('sets the group secret in a free secondary channel and sends events on Tesel’s port', async () => {
    const radio = new FakeRadio();
    const link = await connected(radio);
    expect(link.state).toBe('ready');
    expect(link.family).toBe('meshtastic');
    await link.configureGroupChannel('Rescate Valencia', SECRET);
    const channel: ChannelEntry = { index: 1, role: 'secondary', psk: SECRET, name: 'Rescate Val' };
    expect(radio.sent).toEqual([
      { to: ME, channel: 0, hopLimit: 0, portnum: PORT.admin, payload: setChannel(channel) },
    ]);

    const bytes = new Uint8Array([1, 2, 3]);
    expect(await link.send(bytes)).toEqual({ status: 'sent' });
    expect(radio.sent[1]).toEqual({
      to: BROADCAST,
      channel: 1,
      hopLimit: 3,
      portnum: MESHTASTIC_PORTNUM,
      payload: bytes,
    });
  });

  it('reuses a channel that already holds the secret, with the radio’s hop limit', async () => {
    const lora = {
      usePreset: true,
      modemPreset: 0,
      bandwidth: 0,
      spreadFactor: 0,
      codingRate: 0,
      hopLimit: 5,
    };
    const radio = new FakeRadio({
      channels: channels(['Amigos', OTHER], ['Rescate', SECRET]),
      lora,
    });
    const link = await connected(radio);
    await link.configureGroupChannel('Rescate', SECRET);
    await link.send(new Uint8Array([1]));
    expect(radio.sent).toMatchObject([{ channel: 2, hopLimit: 5 }]);
  });

  it('refuses to take over a radio whose channels are all in use, and never the primary', async () => {
    const full = channels(
      ...Array.from({ length: 7 }, (_, n): [string, Uint8Array] => [`Otro ${n}`, OTHER]),
    );
    const radio = new FakeRadio({ channels: full });
    const link = await connected(radio);
    const failure = link.configureGroupChannel('Rescate', SECRET);
    await expect(failure).rejects.toBeInstanceOf(RadioError);
    await expect(failure).rejects.toMatchObject({ code: 'no-free-channel' });
    expect(radio.sent).toEqual([]);
    expect(await link.send(new Uint8Array([1]))).toMatchObject({ status: 'failed' });
  });

  it('passes on Tesel events of channels with a group secret, each with its secret', async () => {
    const radio = new FakeRadio({ channels: channels(['Rescate', SECRET], ['Antes', OTHER]) });
    const link = await connected(radio);
    const frames: ReceivedFrame[] = [];
    link.onReceive((frame) => frames.push(frame));
    const ours = new Uint8Array([7, 7]);
    radio.hear({ channel: 0, payload: ours }); // the primary channel
    radio.hear({ channel: 1, payload: ours, portnum: 257 }); // another app's port
    radio.hear({ channel: 1, payload: ours, from: ME }); // its own, handed back
    radio.hear({ channel: 1, payload: ours, rxSnr: 6.25 });
    radio.hear({ channel: 2, payload: ours, rxSnr: 1 });
    expect(frames).toEqual([
      { bytes: ours, snr: 6.25, secret: SECRET },
      { bytes: ours, snr: 1, secret: OTHER },
    ]);
  });

  it('keeps the text messages of Meshtastic chat, named by who sent them', async () => {
    const marta = { num: MARTA, user: { longName: 'Marta', shortName: 'MR' }, position: null };
    const radio = new FakeRadio({
      channels: channels(['Rescate', SECRET]),
      nodes: [{ ...marta, lastHeard: 1 }],
    });
    const link = await connected(radio);
    const texts: RadioText[] = [];
    link.onText((text) => texts.push(text));
    const hola = new TextEncoder().encode('¿Alguien en Benimaclet?');
    radio.hear({ portnum: PORT.textMessage, payload: hola, channel: 1, rxTime: 100 });
    radio.hear({ portnum: PORT.textMessage, payload: hola, to: ME, from: 0x1234, rxTime: 101 });
    const text = '¿Alguien en Benimaclet?';
    expect(texts).toEqual([
      { kind: 'channel', channel: 'Rescate', sender: 'Marta', text, time: 100 },
      { kind: 'direct', channel: null, sender: '!00001234', text, time: 101 },
    ]);
  });

  it('tells the names and positions of the other nodes it hears, not its own', async () => {
    const radio = new FakeRadio({
      nodes: [
        { num: ME, user: { longName: 'Yo', shortName: 'YO' }, position: null, lastHeard: 1 },
        { num: MARTA, user: null, position: null, lastHeard: 50 },
      ],
    });
    const link = new MeshtasticRadio(opener([radio]));
    const nodes: MeshtasticNode[] = [];
    link.onNode((node) => nodes.push(node));
    await link.connect();
    const user = new ProtoWriter().string(1, '!0badcafe').string(2, 'Marta').string(3, 'MR');
    radio.hear({ portnum: PORT.nodeInfo, payload: user.finish(), rxTime: 100 });
    const position = new ProtoWriter()
      .fixed32(1, 394_699_000)
      .fixed32(2, -3_763_000)
      .fixed32(4, 1_800_000_000);
    radio.hear({ portnum: PORT.position, payload: position.finish(), rxTime: 200 });
    expect(nodes.map((node) => node.id)).toEqual(['!0badcafe', '!0badcafe', '!0badcafe']);
    expect(nodes.at(-1)).toMatchObject({
      longName: 'Marta',
      shortName: 'MR',
      position: { time: 1_800_000_000 },
      lastHeard: 200,
    });
    expect(nodes.at(-1)?.position?.latitude).toBeCloseTo(39.4699, 6);
  });

  it('disables the channels of groups that were left, never another', async () => {
    const radio = new FakeRadio({ channels: channels(['Amigos', OTHER], ['Rescate', SECRET]) });
    const link = await connected(radio);
    await link.forgetChannels((secret) => secret.every((byte) => byte === 9));
    const disabled: ChannelEntry = { index: 2, role: 'disabled', psk: new Uint8Array(0), name: '' };
    expect(radio.sent).toEqual([
      { to: ME, channel: 0, hopLimit: 0, portnum: PORT.admin, payload: setChannel(disabled) },
    ]);
    // The channel is free again, and the first free one, for the next group.
    await link.configureGroupChannel('Nuevo', SECRET);
    expect(radio.sent[1]?.payload).toEqual(
      setChannel({ index: 2, role: 'secondary', psk: SECRET, name: 'Nuevo' }),
    );
  });

  it('says when the radio did not take a packet, and stays linked', async () => {
    const radio = new FakeRadio({ channels: channels(['Rescate', SECRET]) });
    const link = await connected(radio);
    await link.configureGroupChannel('Rescate', SECRET);
    radio.take = () =>
      Promise.reject(new RadioError('refused', 'the radio did not take the packet (32)'));
    expect(await link.send(new Uint8Array([1]))).toEqual({
      status: 'failed',
      reason: 'the radio did not take the packet (32)',
    });
    expect(link.state).toBe('ready');
  });

  it('estimates airtime from the radio’s LoRa settings', async () => {
    const lora = {
      usePreset: true,
      modemPreset: 4,
      bandwidth: 0,
      spreadFactor: 0,
      codingRate: 0,
      hopLimit: 3,
    };
    const link = new MeshtasticRadio(opener([new FakeRadio({ lora })]));
    const longFast = link.airtimeMs(165);
    await link.connect();
    expect(link.airtimeMs(165)).toBeLessThan(longFast);
  });
});

describe('a Meshtastic radio whose link drops', () => {
  it('reconnects to the same radio by itself and finds its channels again', async () => {
    vi.useFakeTimers();
    const first = new FakeRadio();
    const again = new FakeRadio({ channels: channels(['Rescate', SECRET]) });
    const link = await connected(first, again);
    const states: string[] = [];
    link.onStateChange((state) => states.push(state));
    first.drop();
    expect(link.state).toBe('connecting');
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(link.state).toBe('ready');
    expect(states).toEqual(['connecting', 'ready']);
    await link.configureGroupChannel('Rescate', SECRET);
    expect(again.sent).toEqual([]);
    await link.disconnect();
    vi.useRealTimers();
  });

  it('keeps trying with growing pauses while the radio is out of reach, until disconnected', async () => {
    vi.useFakeTimers();
    const radio = new FakeRadio();
    const link = await connected(radio);
    radio.drop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(link.state).toBe('connecting');
    await link.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(link.state).toBe('disconnected');
    vi.useRealTimers();
  });

  it('gives up on a packet the radio never answers, and on the radio itself', async () => {
    vi.useFakeTimers();
    const radio = new FakeRadio({ channels: channels(['Rescate', SECRET]) });
    const link = await connected(radio);
    await link.configureGroupChannel('Rescate', SECRET);
    radio.take = () => new Promise(() => undefined);
    const outcome = link.send(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(await outcome).toMatchObject({ status: 'failed', reason: 'the radio did not answer' });
    await vi.advanceTimersByTimeAsync(0);
    expect(link.state).toBe('connecting');
    expect(radio.closed).toBe(true);
    await link.disconnect();
    vi.useRealTimers();
  });

  it('lets go of a radio that finishes opening after the user disconnected', async () => {
    let finish: (opened: OpenedRadio<MeshtasticConnection>) => void = () => undefined;
    const radio = new FakeRadio();
    const link = new MeshtasticRadio(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const connecting = link.connect();
    await link.disconnect();
    finish({
      connection: radio,
      name: 'Meshtastic_c3d4',
      reopen: () => Promise.reject(new Error()),
    });
    await connecting;
    expect(link.state).toBe('disconnected');
    expect(radio.closed).toBe(true);
  });
});
