import { describe, expect, it } from 'vitest';

import { positionOf } from './from-radio.ts';
import { MAX_NODES, NodeBook } from './nodes.ts';
import { ProtoMessage, ProtoWriter } from './protobuf.ts';

const names = (longName: string) => ({ user: { longName, shortName: '' }, at: 1 });

function position(latitudeI: number, longitudeI: number): ProtoMessage {
  const parsed = ProtoMessage.parse(
    new ProtoWriter().fixed32(1, latitudeI).fixed32(2, longitudeI).finish(),
  );
  if (!parsed.ok) throw new Error('the position does not parse');
  return parsed.value;
}

describe('the nodes a Meshtastic radio hears', () => {
  it('keeps a bounded book, forgetting the node heard least recently first', () => {
    const book = new NodeBook();
    for (let num = 1; num <= MAX_NODES; num++) book.heard(num, names(`Nodo ${String(num)}`));
    book.heard(1, names('Marta'));
    book.heard(MAX_NODES + 1, names('Otro'));
    // Marta was heard again before the book overflowed: node 2, heard least recently, went.
    expect(book.nameOf(1)).toBe('Marta');
    expect(book.nameOf(2)).toBe('!00000002');
    expect(book.nameOf(3)).toBe('Nodo 3');
    expect(book.nameOf(MAX_NODES + 1)).toBe('Otro');
  });

  it('takes no position off the Earth', () => {
    expect(positionOf(position(394_699_000, -3_763_000))?.latitude).toBeCloseTo(39.4699, 6);
    expect(positionOf(position(950_000_000, 0))).toBeNull();
    expect(positionOf(position(10_000_000, 1_850_000_000))).toBeNull();
    expect(positionOf(position(10_000_000, -1_850_000_000))).toBeNull();
  });
});
