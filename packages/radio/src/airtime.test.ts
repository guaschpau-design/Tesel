import { describe, expect, it } from 'vitest';

import { timeOnAirMs } from './airtime.ts';

describe('LoRa airtime', () => {
  it('matches the reference time on air for SF7, 125 kHz, 4/5', () => {
    // Semtech calculator: 20-byte payload, 8-symbol preamble, explicit header, CRC on.
    const ms = timeOnAirMs(20, {
      spreadingFactor: 7,
      bandwidthHz: 125_000,
      codingRate: 1,
      preambleSymbols: 8,
    });
    expect(ms).toBeCloseTo(56.58, 1);
  });

  it('turns on low data rate optimisation for long symbols, as the radios do', () => {
    // SF12 at 125 kHz has 32.8 ms symbols. 50 bytes at 4/5 with an 8-symbol preamble take 58
    // payload symbols with the optimisation (2302 ms), 53 without it (2138 ms).
    const ms = timeOnAirMs(50, {
      spreadingFactor: 12,
      bandwidthHz: 125_000,
      codingRate: 1,
      preambleSymbols: 8,
    });
    expect(ms).toBeCloseTo(2301.95, 1);
  });
});
