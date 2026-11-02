// Two devices without internet: what one publishes reaches the other through their radios.

import 'fake-indexeddb/auto';

import type { RadioLink, RadioLinkState, ReceivedFrame, SendOutcome } from '@tesel/radio';
import { describe, expect, it, vi } from 'vitest';

import { applyInvitation, createGroup, invitationFor } from '../groups/group.ts';
import { createLocalIdentity } from '../identity/identity.ts';
import { openAppDb } from '../storage/app-db.ts';
import { GroupFeed } from '../sync/group-feed.svelte.ts';
import { RadioSession } from './radio.svelte.ts';

/** Radios that hear each other: whatever one sends, every other one receives. */
class Air {
  readonly radios: AirLink[] = [];

  link(): AirLink {
    const radio = new AirLink(this);
    this.radios.push(radio);
    return radio;
  }
}

class AirLink implements RadioLink {
  readonly family = 'meshtastic';
  state: RadioLinkState = 'disconnected';
  name: string | null = 'MeshCore';
  readonly #air: Air;
  #receive: ((frame: ReceivedFrame) => void) | null = null;
  #stateChange: ((state: RadioLinkState) => void) | null = null;

  constructor(air: Air) {
    this.#air = air;
  }

  connect(): Promise<void> {
    this.state = 'ready';
    this.#stateChange?.('ready');
    return Promise.resolve();
  }

  configureGroupChannel(): Promise<void> {
    return Promise.resolve();
  }

  forgetChannels(): Promise<void> {
    return Promise.resolve();
  }

  send(bytes: Uint8Array, secret: Uint8Array): Promise<SendOutcome> {
    for (const radio of this.#air.radios) {
      if (radio !== this) radio.#receive?.({ bytes, snr: 5, secret });
    }
    return Promise.resolve({ status: 'sent' });
  }

  airtimeMs(): number {
    return 1000;
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receive = listener;
    return () => undefined;
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateChange = listener;
    return () => undefined;
  }

  onText(): () => void {
    return () => undefined;
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

describe('the radio path', () => {
  it('carries announcements, chat and an SOS between devices with no server', async () => {
    const group = createGroup('Rescate', null, 0);
    const ana = createLocalIdentity('Ana', 0);
    const berta = createLocalIdentity('Berta', 0);
    const bertaGroup = applyInvitation(
      undefined,
      invitationFor(group, 'member', ana.nodeId),
      0,
    ).group;

    const air = new Air();
    const anaFeed = await GroupFeed.open(await openAppDb('radio-path-ana'), group, ana);
    const bertaFeed = await GroupFeed.open(await openAppDb('radio-path-berta'), bertaGroup, berta);
    for (const [feed, link] of [
      [anaFeed, air.link()],
      [bertaFeed, air.link()],
    ] as const) {
      const radio = new RadioSession(
        () => Promise.resolve(link),
        () => 0,
      );
      await radio.connect();
      await radio.useFeed(feed);
    }

    await anaFeed.sendChat('¿Me oís por radio?');
    await anaFeed.sendSos('medical', { lat: 39.47, lon: -0.37 }, 10, 'Tobillo');

    await vi.waitFor(
      () => {
        expect(bertaFeed.state.chat.map((line) => line.text)).toEqual(['¿Me oís por radio?']);
        expect([...bertaFeed.state.sos.values()].flat().map((call) => call.text)).toEqual([
          'Tobillo',
        ]);
        // Berta learnt Ana's alias from her announcement, which travelled by radio too.
        expect(bertaFeed.state.members.get(ana.nodeId)?.alias).toBe('Ana');
      },
      { timeout: 10_000, interval: 200 },
    );
  }, 15_000);

  it('sends an SOS made while no radio was linked as soon as one is', async () => {
    const group = createGroup('Rescate', null, 0);
    const ana = createLocalIdentity('Ana', 0);
    const berta = createLocalIdentity('Berta', 0);
    const bertaGroup = applyInvitation(
      undefined,
      invitationFor(group, 'member', ana.nodeId),
      0,
    ).group;
    const air = new Air();
    const anaFeed = await GroupFeed.open(await openAppDb('radio-late-ana'), group, ana);
    const bertaFeed = await GroupFeed.open(await openAppDb('radio-late-berta'), bertaGroup, berta);
    const bertaRadio = new RadioSession(
      () => Promise.resolve(air.link()),
      () => 0,
    );
    await bertaRadio.connect();
    await bertaRadio.useFeed(bertaFeed);

    // Ana's radio is off when she calls for help.
    await anaFeed.sendSos('trapped', { lat: 39.47, lon: -0.37 }, 10, 'Atrapada');
    expect(anaFeed.undelivered.size).toBeGreaterThan(0);
    const anaRadio = new RadioSession(
      () => Promise.resolve(air.link()),
      () => 0,
    );
    await anaRadio.connect();
    await anaRadio.useFeed(anaFeed);

    await vi.waitFor(
      () => {
        expect([...bertaFeed.state.sos.values()].flat().map((call) => call.text)).toEqual([
          'Atrapada',
        ]);
        expect(anaFeed.undelivered.size).toBe(0);
      },
      { timeout: 10_000, interval: 200 },
    );
  }, 15_000);
});
