// This device's identity (ARCHITECTURE.md §3.1): a key pair generated on first launch and an
// alias the user picks. There are no accounts; the private key never leaves the device.

import {
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  generateIdentity,
  type Identity,
  type RandomSource,
} from '@tesel/protocol';

import { nameFault, type NameFault } from '../names/names.ts';

export interface LocalIdentity extends Identity {
  readonly alias: string;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
}

/** What is wrong with an alias as typed, once trimmed (names.ts), or null. */
export function aliasFault(text: string): NameFault | null {
  return nameFault(text.trim(), ALIAS_MIN_BYTES, ALIAS_MAX_BYTES);
}

/** Trims an alias and returns it, or null if it cannot be used (aliasFault). */
export function normalizeAlias(text: string): string | null {
  return aliasFault(text) === null ? text.trim() : null;
}

export function createLocalIdentity(
  alias: string,
  now: number,
  random?: RandomSource,
): LocalIdentity {
  return { ...generateIdentity(random), alias, createdAt: now };
}
