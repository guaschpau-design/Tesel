// Tesel's mark drawn into a PDF from the brand's own file, brand/mark.svg (ADR-0116): its four
// tiles turned 45° inside the pin, the three of the head in the ink given and the tip in lime.

import markSvg from '../../../../../brand/mark.svg?raw';

import type { PdfDocument, Rgb } from './pdf-document.ts';

const SIZE = Number(/viewBox="0 0 (\d+(?:\.\d+)?) /.exec(markSvg)?.[1] ?? 90);
const CLIP = /<clipPath[^>]*><path d="([^"]+)"/.exec(markSvg)?.[1] ?? '';
const TURN = /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(markSvg);
const TILES = [...markSvg.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map((match) => ({
  d: match[1] ?? '',
  ink: match[2] === 'currentColor',
}));

/** The lime of the node (ADR-0113). */
export const LIME: Rgb = [0.6, 0.788, 0.22];

/** The mark, `size` points wide, its top left at (x, y); the head in `ink`. */
export function drawMark(doc: PdfDocument, x: number, y: number, size: number, ink: Rgb): void {
  doc.svg(
    { x, y, scale: size / SIZE },
    TILES.map((tile) => ({ d: tile.d, fill: tile.ink ? ink : LIME })),
    {
      clip: CLIP,
      rotate: Number(TURN?.[1] ?? 0),
      about: [Number(TURN?.[2] ?? 0), Number(TURN?.[3] ?? 0)],
    },
  );
}
