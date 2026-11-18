import { describe, expect, it } from 'vitest';

import { inRed, tacticalFlavor } from './tactical.ts';

describe('inRed', () => {
  it('turns each colour into a red as light as it was', () => {
    expect(inRed({ white: '#ffffff', black: '#000', grey: 'rgba(100, 100, 100, 0.5)' })).toEqual({
      white: 'rgba(255, 51, 41, 1)',
      black: 'rgba(0, 0, 0, 1)',
      grey: 'rgba(115, 20, 16, 0.5)',
    });
  });

  it('reaches colours nested in the palette and leaves what is not a colour', () => {
    expect(inRed({ landcover: { forest: '#808080' }, regular: 'Noto Sans Regular' })).toEqual({
      landcover: { forest: 'rgba(147, 26, 20, 1)' },
      regular: 'Noto Sans Regular',
    });
  });
});

describe('tacticalFlavor', () => {
  it('writes every colour of the night map as a red', () => {
    const colours = JSON.stringify(tacticalFlavor(true)).match(/#[0-9a-f]{3,6}\b/gi) ?? [];
    expect(colours).toEqual([]);
  });
});
