// How long a Tesel frame keeps the air busy when a MeshCore radio sends it (ADR-0015).

import { timeOnAirMs, type LoraModulation } from '@tesel/radio';

/**
 * MeshCore's "EU/UK (Narrow)" preset: 869.618 MHz, 62.5 kHz, SF8. The coding rate and preamble
 * are taken at their most expensive plausible values so estimates err on the safe side.
 */
const EU_NARROW: LoraModulation = {
  spreadingFactor: 8,
  bandwidthHz: 62_500,
  codingRate: 4,
  preambleSymbols: 16,
};

/** MeshCore packet bytes outside the encryption: header 1, path length 1, channel hash 1, MAC 2. */
const MESHCORE_CLEAR_BYTES = 5;
/** The datagram's data type, encrypted with the frame. */
const DATA_TYPE_BYTES = 2;
/** MeshCore encrypts with AES, padding to whole blocks. */
const AES_BLOCK_BYTES = 16;

/** Size on the air of a channel datagram carrying `frameBytes`, in a flood (no path yet). */
function packetSize(frameBytes: number): number {
  const encrypted = Math.ceil((frameBytes + DATA_TYPE_BYTES) / AES_BLOCK_BYTES) * AES_BLOCK_BYTES;
  return MESHCORE_CLEAR_BYTES + encrypted;
}

/** Time on air of one Tesel frame (a sealed event) sent through MeshCore, in milliseconds. */
export function meshcoreAirtimeMs(frameBytes: number): number {
  return timeOnAirMs(packetSize(frameBytes), EU_NARROW);
}
