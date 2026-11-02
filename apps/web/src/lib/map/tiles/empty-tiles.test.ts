import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { EMPTY_RASTER_TILE } from './empty-tiles.ts';

/** The one pixel of a 1 × 1 RGBA PNG: its IDAT chunk, inflated, is a filter byte and RGBA. */
function onlyPixel(png: ArrayBuffer): number[] {
  const bytes = new Uint8Array(png);
  const view = new DataView(png);
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (type === 'IDAT') {
      return [...inflateSync(bytes.subarray(at + 8, at + 8 + length)).subarray(1)];
    }
    at += 12 + length;
  }
  throw new Error('no image data');
}

describe('empty tiles', () => {
  it('shows nothing where a raster tile cannot be had: its pixel is fully transparent', () => {
    expect(onlyPixel(EMPTY_RASTER_TILE)).toEqual([0, 0, 0, 0]);
  });
});
