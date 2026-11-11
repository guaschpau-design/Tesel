// Tesel's mark drawn into a PDF from the brand's own file, brand/mark.svg (ADR-0129): the T in the
// ink given and the tile at its foot in lime.

import markSvg from '../../../../../brand/mark.svg?raw';

import type { PdfDocument, Rgb } from './pdf-document.ts';

const SIZE = Number(/viewBox="0 0 (\d+(?:\.\d+)?) /.exec(markSvg)?.[1] ?? 100);
const SHAPES = [...markSvg.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map((match) => ({
  d: match[1] ?? '',
  ink: match[2] === 'currentColor',
}));

/** The lime of the node (ADR-0113). */
export const LIME: Rgb = [0.6, 0.788, 0.22];

/** The mark, `size` points wide, its top left at (x, y); the T in `ink`. */
export function drawMark(doc: PdfDocument, x: number, y: number, size: number, ink: Rgb): void {
  doc.svg(
    { x, y, scale: size / SIZE },
    SHAPES.map((shape) => ({ d: shape.d, fill: shape.ink ? ink : LIME })),
  );
}
