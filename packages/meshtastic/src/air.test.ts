import { describe, expect, it } from 'vitest';

import { meshtasticAirtimeMs } from './air.ts';
import type { LoraSettings } from './from-radio.ts';

const preset = (modemPreset: number, codingRate = 0): LoraSettings => ({
  usePreset: true,
  modemPreset,
  bandwidth: 0,
  spreadFactor: 0,
  codingRate,
  hopLimit: 3,
});

describe('Meshtastic airtime', () => {
  it('puts the largest Tesel event at 1.7 s on LongFast, the default', () => {
    // 189 bytes on the air: a 16-byte header, Data of 171 bytes and the radio's bitfield. At SF11,
    // 250 kHz and 4/5 that is 183 payload symbols after a 16-symbol preamble, of 8.192 ms each.
    expect(meshtasticAirtimeMs(165, null)).toBeCloseTo(1665.02, 1);
    expect(meshtasticAirtimeMs(165, preset(0))).toBeCloseTo(1665.02, 1);
  });

  it('follows the preset the radio uses, and a coding rate set on top of it', () => {
    const mediumFast = meshtasticAirtimeMs(165, preset(4));
    expect(mediumFast).toBeLessThan(meshtasticAirtimeMs(165, null) / 3);
    expect(meshtasticAirtimeMs(165, preset(4, 8))).toBeGreaterThan(mediumFast);
  });

  it('counts a preset it does not know as the slowest it does', () => {
    const unknown = meshtasticAirtimeMs(165, preset(42));
    expect(unknown).toBeGreaterThan(meshtasticAirtimeMs(165, preset(1)));
    expect(unknown).toBe(meshtasticAirtimeMs(165, preset(2)));
  });

  it('reads settings of its own, with Meshtastic’s codes for odd bandwidths', () => {
    const custom: LoraSettings = {
      usePreset: false,
      modemPreset: 0,
      bandwidth: 62,
      spreadFactor: 12,
      codingRate: 8,
      hopLimit: 3,
    };
    expect(meshtasticAirtimeMs(165, custom)).toBe(meshtasticAirtimeMs(165, preset(2)));
    expect(meshtasticAirtimeMs(165, { ...custom, spreadFactor: 0 })).toBe(
      meshtasticAirtimeMs(165, preset(2)),
    );
  });
});
