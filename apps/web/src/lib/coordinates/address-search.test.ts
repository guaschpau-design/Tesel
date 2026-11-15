import { describe, expect, it } from 'vitest';

import { foundIn, looksLikeAddress } from './address-search.ts';

describe('addresses found by CartoCiudad', () => {
  it('takes each address with its place, and nothing else', () => {
    const answer = [
      { address: 'CALLE LLOVERA 10, Reus', lat: 41.1562, lng: 1.1071, type: 'portal' },
      { address: 'Reus', lat: null, lng: null, type: 'municipio' },
      { address: 'CALLE LLOVERA, Reus', lat: 41.156, lng: 1.107, type: 'callejero' },
      'nonsense',
    ];
    expect(foundIn(answer)).toEqual([
      { name: 'CALLE LLOVERA 10, Reus', at: { lat: 41.1562, lon: 1.1071 } },
      { name: 'CALLE LLOVERA, Reus', at: { lat: 41.156, lon: 1.107 } },
    ]);
    expect(foundIn({ error: 'busy' })).toEqual([]);
  });

  it('tells an address from coordinates by its words', () => {
    expect(looksLikeAddress('Calle Mayor 23, Reus')).toBe(true);
    expect(looksLikeAddress('39.4699, -0.3763')).toBe(false);
    expect(looksLikeAddress('30S YJ 25695 72210')).toBe(false);
    expect(looksLikeAddress('39°28′11″N 0°22′35″W')).toBe(false);
  });
});
