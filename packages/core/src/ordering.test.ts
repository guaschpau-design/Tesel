import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { compareEvents, newerOf } from './ordering.ts';

const chat = (origin: string, seq: number, time: number, text = 'hola'): TeselEvent => ({
  type: 'chat',
  origin: origin as NodeId,
  seq,
  time,
  text,
});

describe('last-writer-wins ordering', () => {
  it('orders by time first', () => {
    expect(compareEvents(chat('ffffffff', 9, 100), chat('00000000', 1, 101))).toBeLessThan(0);
  });

  it('breaks time ties by origin, comparing bytes as unsigned values', () => {
    expect(compareEvents(chat('0a000000', 1, 100), chat('a0000000', 1, 100))).toBeLessThan(0);
  });

  it('breaks origin ties by sequence number', () => {
    expect(compareEvents(chat('a1b2c3d4', 2, 100), chat('a1b2c3d4', 1, 100))).toBeGreaterThan(0);
  });

  it('returns 0 only for the same event', () => {
    expect(compareEvents(chat('a1b2c3d4', 1, 100), chat('a1b2c3d4', 1, 100))).toBe(0);
  });

  it('orders rivals with the same time, origin and sequence number by their bytes', () => {
    const a = chat('a1b2c3d4', 1, 100, 'a');
    const b = chat('a1b2c3d4', 1, 100, 'b');
    expect(compareEvents(a, b)).toBeLessThan(0);
    expect(compareEvents(b, a)).toBeGreaterThan(0);
  });

  it('picks the same winner whatever the argument order', () => {
    const a = chat('a1b2c3d4', 1, 100);
    const b = chat('0f1e2d3c', 7, 100);
    expect(newerOf(a, b)).toBe(newerOf(b, a));
  });
});
