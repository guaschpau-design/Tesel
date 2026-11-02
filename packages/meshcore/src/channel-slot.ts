// Choosing the radio channel slot for a group (protocol §7.1).

import { bytesEqual } from '@tesel/protocol';

import type { ChannelInfo } from './companion.ts';

/** MeshCore channel names are 32-byte C strings: at most 31 bytes of UTF-8. */
export const CHANNEL_NAME_MAX_BYTES = 31;

export type SlotChoice =
  | { readonly kind: 'reuse'; readonly index: number }
  | { readonly kind: 'empty'; readonly index: number }
  | { readonly kind: 'full' };

/**
 * The slot that already holds the secret, or else the first empty one. A slot is empty when
 * its name is empty and its secret is all zeros, which is how MeshCore clears a channel.
 * Slot 0 is MeshCore's public channel and is never used.
 */
export function chooseChannelSlot(
  channels: readonly ChannelInfo[],
  secret: Uint8Array,
): SlotChoice {
  const candidates = channels.filter((channel) => channel.channelIdx !== 0);
  const existing = candidates.find((channel) => bytesEqual(channel.secret, secret));
  if (existing) return { kind: 'reuse', index: existing.channelIdx };
  const empty = candidates.find(
    (channel) => channel.name === '' && channel.secret.every((byte) => byte === 0),
  );
  return empty ? { kind: 'empty', index: empty.channelIdx } : { kind: 'full' };
}
