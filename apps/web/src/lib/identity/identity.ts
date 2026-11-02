// This device's identity (ARCHITECTURE.md §3.1): a key pair generated on first launch and an
// alias the user picks. There are no accounts; the private key never leaves the device.

import {
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  generateIdentity,
  isWellFormedText,
  utf8ByteLength,
  type Identity,
  type RandomSource,
} from '@tesel/protocol';

export interface LocalIdentity extends Identity {
  readonly alias: string;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
}

/**
 * Trims an alias and returns it, or null if it does not fit the protocol's limits or holds half of
 * a surrogate pair, which no event could carry.
 */
export function normalizeAlias(text: string): string | null {
  const alias = text.trim();
  const size = utf8ByteLength(alias);
  return isWellFormedText(alias) && size >= ALIAS_MIN_BYTES && size <= ALIAS_MAX_BYTES
    ? alias
    : null;
}

export function createLocalIdentity(
  alias: string,
  now: number,
  random?: RandomSource,
): LocalIdentity {
  return { ...generateIdentity(random), alias, createdAt: now };
}
