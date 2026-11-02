// How long a Tesel frame keeps the air busy when a Meshtastic radio sends it (ADR-0015, ADR-0098),
// from the LoRa settings the radio reports when it connects.

import { MESHTASTIC_PORTNUM } from '@tesel/protocol';
import { timeOnAirMs, type LoraModulation } from '@tesel/radio';

import type { LoraSettings } from './from-radio.ts';
import { data } from './to-radio.ts';

interface Preset {
  readonly spreadingFactor: number;
  readonly bandwidthKHz: number;
  /** The denominator of the coding rate, 5 to 8. */
  readonly codingRate: number;
}

const LONG_FAST: Preset = { spreadingFactor: 11, bandwidthKHz: 250, codingRate: 5 };
/** Dropped from recent firmware, still on older radios; the slowest of all. */
const VERY_LONG_SLOW: Preset = { spreadingFactor: 12, bandwidthKHz: 62.5, codingRate: 8 };

/** Meshtastic's modem presets by `ModemPreset` value, outside the 2.4 GHz band. */
const PRESETS: ReadonlyMap<number, Preset> = new Map([
  [0, LONG_FAST], // the default
  [1, { spreadingFactor: 12, bandwidthKHz: 125, codingRate: 8 }], // LONG_SLOW
  [2, VERY_LONG_SLOW],
  [3, { spreadingFactor: 10, bandwidthKHz: 250, codingRate: 5 }], // MEDIUM_SLOW
  [4, { spreadingFactor: 9, bandwidthKHz: 250, codingRate: 5 }], // MEDIUM_FAST
  [5, { spreadingFactor: 8, bandwidthKHz: 250, codingRate: 5 }], // SHORT_SLOW
  [6, { spreadingFactor: 7, bandwidthKHz: 250, codingRate: 5 }], // SHORT_FAST
  [7, { spreadingFactor: 11, bandwidthKHz: 125, codingRate: 8 }], // LONG_MODERATE
  [8, { spreadingFactor: 7, bandwidthKHz: 500, codingRate: 5 }], // SHORT_TURBO
  [9, { spreadingFactor: 11, bandwidthKHz: 500, codingRate: 8 }], // LONG_TURBO
]);

/** A preset this code does not know is counted as the slowest it does, to err on the safe side. */
const SLOWEST = VERY_LONG_SLOW;

/** Meshtastic radios send a 16-symbol preamble. */
const PREAMBLE_SYMBOLS = 16;
/** The packet header in clear: to, from, id, flags, channel hash, next hop, relay node. */
const HEADER_BYTES = 16;
/** The radio adds a `bitfield` to the `Data` of what it sends: a tag and a byte. */
const BITFIELD_BYTES = 2;

/** Bandwidths Meshtastic writes as whole kHz that are not (its `bwCodeToKHz`). */
const BANDWIDTH_CODES: ReadonlyMap<number, number> = new Map([
  [31, 31.25],
  [62, 62.5],
  [200, 203.125],
  [400, 406.25],
  [800, 812.5],
  [1600, 1625],
]);

/**
 * Time on air of one Tesel frame sent by a Meshtastic radio with `lora` settings, in milliseconds.
 * Without settings, Meshtastic's default, LongFast, is assumed.
 */
export function meshtasticAirtimeMs(frameBytes: number, lora: LoraSettings | null): number {
  const payload = data(MESHTASTIC_PORTNUM, new Uint8Array(frameBytes)).finish().length;
  return timeOnAirMs(HEADER_BYTES + payload + BITFIELD_BYTES, modulationOf(presetOf(lora)));
}

function presetOf(lora: LoraSettings | null): Preset {
  if (lora === null) return LONG_FAST;
  if (!lora.usePreset) return customPreset(lora) ?? SLOWEST;
  const preset = PRESETS.get(lora.modemPreset) ?? SLOWEST;
  // The radio honours a coding rate set on top of a preset.
  const codingRate = validCodingRate(lora.codingRate) ? lora.codingRate : preset.codingRate;
  return { ...preset, codingRate };
}

function customPreset(lora: LoraSettings): Preset | null {
  const valid =
    lora.spreadFactor >= 5 &&
    lora.spreadFactor <= 12 &&
    lora.bandwidth > 0 &&
    validCodingRate(lora.codingRate);
  if (!valid) return null;
  return {
    spreadingFactor: lora.spreadFactor,
    bandwidthKHz: BANDWIDTH_CODES.get(lora.bandwidth) ?? lora.bandwidth,
    codingRate: lora.codingRate,
  };
}

function validCodingRate(codingRate: number): boolean {
  return codingRate >= 5 && codingRate <= 8;
}

function modulationOf(preset: Preset): LoraModulation {
  return {
    spreadingFactor: preset.spreadingFactor,
    bandwidthHz: preset.bandwidthKHz * 1000,
    codingRate: preset.codingRate - 4,
    preambleSymbols: PREAMBLE_SYMBOLS,
  };
}
