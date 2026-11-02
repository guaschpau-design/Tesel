// Which of a Meshtastic radio's eight channels holds a group (protocol §7.2).

import { bytesEqual, GROUP_SECRET_SIZE } from '@tesel/protocol';

import type { ChannelEntry } from './to-radio.ts';

/** Meshtastic channel names are 12-byte C strings: at most 11 bytes of UTF-8. */
export const CHANNEL_NAME_MAX_BYTES = 11;

export type ChannelChoice =
  | { readonly kind: 'reuse'; readonly index: number }
  | { readonly kind: 'empty'; readonly index: number }
  | { readonly kind: 'full' };

/**
 * The channel that already holds the secret, or else the first disabled one. The primary channel
 * is the radio's own, the one its other users talk on, and is never used.
 */
export function chooseChannel(
  channels: readonly ChannelEntry[],
  secret: Uint8Array,
): ChannelChoice {
  const existing = channels.find((channel) => {
    const held = groupSecretOf(channel);
    return held !== null && bytesEqual(held, secret);
  });
  if (existing) return { kind: 'reuse', index: existing.index };
  const empty = channels.find((channel) => channel.role === 'disabled');
  return empty ? { kind: 'empty', index: empty.index } : { kind: 'full' };
}

/** The radio's channels with `channel` set, in the order of their index. */
export function withChannel(
  channels: readonly ChannelEntry[],
  channel: ChannelEntry,
): ChannelEntry[] {
  return [...channels.filter(({ index }) => index !== channel.index), channel].sort(
    (a, b) => a.index - b.index,
  );
}

/**
 * The group secret a channel holds: the key of an enabled secondary channel, when it is as long as
 * a group secret. Any other channel holds none Tesel could have put there.
 */
export function groupSecretOf(channel: ChannelEntry): Uint8Array | null {
  const held = channel.role === 'secondary' && channel.psk.length === GROUP_SECRET_SIZE;
  return held ? channel.psk : null;
}
