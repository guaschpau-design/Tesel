// How this device reaches its group right now, named by the medium it travels on — WiFi, mobile
// data, LoRa — rather than by the service: the header shows it and the connections panel details
// each channel.

import type { RadioLinkState } from '@tesel/meshcore/link';

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { StatusTone } from '../ui/status-tone.ts';
import type { FeedStatus } from '../sync/group-feed.svelte.ts';
import type { Channel } from './heard.ts';

/** What the browser says of its network (Network Information API); undefined where it does not. */
export interface Network {
  /** 'wifi', 'cellular', 'ethernet'… */
  readonly type: string | undefined;
  /** How fast it behaves: 'slow-2g', '2g', '3g' or '4g', the fastest it reports. */
  readonly effectiveType: string | undefined;
}

export interface LinkInput {
  /** The active group's sync with its server, or null without a group. */
  readonly server: FeedStatus | null;
  readonly radio: 'off' | 'connecting' | 'linked';
  /** Whether the browser believes it is online; it only matters when `server` is null. */
  readonly browserOnline: boolean;
}

export interface Link {
  /** The channels that work now, in this order: internet, then radio. */
  readonly channels: readonly Channel[];
  readonly level: 'ok' | 'connecting' | 'none';
}

/** The colour of the dot for each level. */
export const LEVEL_TONES: Readonly<Record<Link['level'], StatusTone>> = {
  ok: 'good',
  connecting: 'fair',
  none: 'poor',
};

export function linkOf(input: LinkInput): Link {
  const channels: Channel[] = [];
  const serverUp = input.server === null ? input.browserOnline : input.server === 'synced';
  if (serverUp) channels.push('internet');
  if (input.radio === 'linked') channels.push('radio');
  if (channels.length > 0) return { channels, level: 'ok' };
  const connecting =
    input.server === 'connecting' || input.server === 'syncing' || input.radio === 'connecting';
  return { channels, level: connecting ? 'connecting' : 'none' };
}

/** The link in a word, as the header says it beside the signs of the media. */
export function linkWord(link: Link): MessageKey {
  switch (link.level) {
    case 'ok':
      return link.channels.includes('internet') ? 'linkOnline' : 'linkByRadio';
    case 'connecting':
      return 'linkConnecting';
    case 'none':
      return 'linkNone';
  }
}

/**
 * The medium of the internet channel. Browsers do not tell 4G from 5G, so the fastest mobile data is
 * "4G/5G"; where the browser says nothing (iPhone, most computers) it is "WiFi/5G".
 */
export function networkName(network: Network): MessageKey {
  if (network.type === 'wifi') return 'mediumWifi';
  if (network.type === 'ethernet') return 'mediumCable';
  if (network.type !== 'cellular') return 'mediumUnknown';
  if (network.effectiveType === '3g') return 'mediumMobile3g';
  if (network.effectiveType === '2g' || network.effectiveType === 'slow-2g')
    return 'mediumMobile2g';
  return 'mediumMobile';
}

/** The medium of each channel, as the header names it. */
export function channelName(channel: Channel, network: Network): MessageKey {
  switch (channel) {
    case 'internet':
      return networkName(network);
    case 'radio':
      return 'mediumLora';
  }
}

/** The sign of the network channel: bars of signal on mobile data, WiFi waves otherwise. */
export function networkSign(channel: Channel, network: Network): GlyphName {
  return channel === 'internet' && network.type === 'cellular' ? 'signal' : 'wifi';
}

/** What the radio contributes: off, on its way (pairing, or paired but not on the group yet), or linked. */
export function radioLinkOf(radio: {
  readonly state: RadioLinkState;
  readonly linked: boolean;
}): LinkInput['radio'] {
  if (radio.linked) return 'linked';
  return radio.state === 'disconnected' ? 'off' : 'connecting';
}

/** The state of the network channel, in a few words for the connections panel. */
export function networkStatus(input: LinkInput): { level: Link['level']; label: MessageKey } {
  if (input.server === null) {
    return input.browserOnline
      ? { level: 'ok', label: 'netNoGroup' }
      : { level: 'none', label: 'netOffline' };
  }
  switch (input.server) {
    case 'synced':
      return { level: 'ok', label: 'netServer' };
    case 'connecting':
    case 'syncing':
      return { level: 'connecting', label: 'linkConnecting' };
    case 'disconnected':
      return { level: 'none', label: 'netOffline' };
    case 'local-only':
      return { level: 'none', label: 'netNoServer' };
  }
}
