import { EquipmentBit } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { EQUIPMENT, PROFILES, TYPICAL_EQUIPMENT, ownEquipment } from './member-catalog.ts';

describe('what this person carries', () => {
  it('adds the LoRa radio while one is linked, and never keeps one picked by hand', () => {
    expect(ownEquipment(['water'], true)).toEqual(['water', 'lora']);
    expect(ownEquipment(['water'], false)).toEqual(['water']);
    expect(ownEquipment(['lora', 'rope'], false)).toEqual(['rope']);
    expect(ownEquipment(['lora'], true)).toEqual(['lora']);
  });

  it('never offers the LoRa radio to pick by hand', () => {
    expect(EQUIPMENT.map((item) => item.value)).not.toContain('lora');
  });

  it('offers every other item once, in one group', () => {
    const offered = EQUIPMENT.map((item) => item.value);
    const all = Object.keys(EquipmentBit).filter((item) => item !== 'lora');
    expect([...offered].sort()).toEqual(all.sort());
  });

  it('offers first, for each profile, a few items that can be picked', () => {
    const offered = new Set(EQUIPMENT.map((item) => item.value));
    for (const { value } of PROFILES) {
      const typical = TYPICAL_EQUIPMENT[value];
      expect(typical.length).toBeLessThanOrEqual(6);
      expect(new Set(typical).size).toBe(typical.length);
      for (const item of typical) expect(offered.has(item)).toBe(true);
    }
  });
});
