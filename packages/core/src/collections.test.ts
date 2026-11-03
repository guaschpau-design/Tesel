import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { insertAllOrdered } from './collections.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const chat = (seq: number, time = T0 + seq): TeselEvent => ({
  type: 'chat',
  origin: ANA,
  seq,
  time,
  text: 'hola',
});

describe('inserting events in order', () => {
  it('puts a few events where they belong, and many, the same way', () => {
    const list = [chat(1), chat(3), chat(5)];
    const few = [chat(4), chat(2), chat(3)];
    const many = Array.from({ length: 40 }, (_, i) => chat(i + 6, T0 - i));
    expect(insertAllOrdered(list, few).map(({ seq }) => seq)).toEqual([1, 2, 3, 4, 5]);
    const all = insertAllOrdered(list, many);
    expect(all).toHaveLength(43);
    expect(insertAllOrdered(list, [...many].reverse())).toEqual(all);
  });

  it('gives the list itself when every event is in it already', () => {
    const list = [chat(1), chat(2)];
    expect(insertAllOrdered(list, [chat(2), chat(1)])).toBe(list);
    expect(insertAllOrdered(list, [])).toBe(list);
  });
});
