// How long a LoRa packet occupies the air (Semtech AN1200.13 time-on-air formula). Each kind of
// radio wraps an event in its own packet; with this it tells the airtime budget what one costs
// (RadioLink.airtimeMs, ADR-0015).

/** The LoRa settings that decide how long a packet takes on the air. */
export interface LoraModulation {
  readonly spreadingFactor: number;
  readonly bandwidthHz: number;
  /** 1 to 4 for coding rates 4/5 to 4/8. */
  readonly codingRate: number;
  readonly preambleSymbols: number;
}

/** Time on air of a packet with `payloadBytes` bytes, explicit header and CRC, in milliseconds. */
export function timeOnAirMs(payloadBytes: number, modulation: LoraModulation): number {
  const { spreadingFactor: sf, bandwidthHz, codingRate, preambleSymbols } = modulation;
  const symbolMs = (2 ** sf / bandwidthHz) * 1000;
  const lowDataRateOptimize = symbolMs > 16 ? 1 : 0;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil((8 * payloadBytes - 4 * sf + 28 + 16) / (4 * (sf - 2 * lowDataRateOptimize))) *
        (codingRate + 4),
      0,
    );
  return (preambleSymbols + 4.25 + payloadSymbols) * symbolMs;
}
