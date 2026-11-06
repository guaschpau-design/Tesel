// The pages of a debrief as they fill (ADR-0118): Tesel's palette for print, the margins, a
// cursor that goes down the page and turns it when what comes does not fit, section headings,
// and the running header and footer every page but the first gets.

import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PdfDocument,
  type Rgb,
  type TextStyle,
} from '../pdf/pdf-document.ts';
import { wrap } from '../pdf/pdf-text.ts';
import { drawMark, LIME } from '../pdf/tesel-mark.ts';

/** Tesel's graphite and pale (ADR-0113), and the greys, red and tints of print. */
export const INK: Rgb = [0.094, 0.098, 0.106];
export const PALE: Rgb = [0.922, 0.929, 0.922];
export const MUTED: Rgb = [0.38, 0.4, 0.42];
export const RULE: Rgb = [0.85, 0.86, 0.85];
export const TINT: Rgb = [0.957, 0.961, 0.953];
export const RED: Rgb = [0.78, 0.16, 0.12];
export const RED_TINT: Rgb = [0.992, 0.937, 0.929];
export const LIME_DEEP: Rgb = [0.286, 0.4, 0.055];
export { LIME };

export const LEFT = 48;
export const RIGHT = PAGE_WIDTH - 48;
export const WIDTH = RIGHT - LEFT;
/** Where the text of a page starts, below its header, and ends, above its footer. */
const TOP = 76;
const BOTTOM = PAGE_HEIGHT - 60;

export const BODY: TextStyle = { size: 9, color: INK };
export const SMALL: TextStyle = { size: 7.5, color: MUTED };

export class Sheet {
  readonly doc = new PdfDocument();
  /** Where the next thing goes, in points from the top. */
  y = 0;

  constructor() {
    this.doc.addPage();
  }

  /** Room for `height` more points on this page, or a new page. */
  room(height: number): void {
    if (this.y + height <= BOTTOM) return;
    this.doc.addPage();
    this.y = TOP;
  }

  /** A section's heading: a lime tile and its name, with room for a first line under it. */
  heading(title: string, keep = 60): void {
    this.room(28 + keep);
    this.y += 10;
    this.doc.rect(LEFT, this.y - 8.5, 4, 11, { fill: LIME });
    this.doc.text(LEFT + 11, this.y, title, { size: 12.5, bold: true, color: INK });
    this.y += 16;
  }

  /** Text broken into lines at `x`, `width` wide; returns how tall it was. */
  paragraph(x: number, text: string, width: number, style: TextStyle, leading = 12): number {
    const lines = wrap(text, width, style.size, style.bold);
    lines.forEach((line, index) => {
      this.doc.text(x, this.y + index * leading, line, style);
    });
    return lines.length * leading;
  }

  /** The running header and footer, on every page; the header on all but the first. */
  finish(title: string, footer: (page: number, pages: number) => string): void {
    const pages = this.doc.pageCount;
    for (let page = 0; page < pages; page++) {
      this.doc.turnTo(page);
      if (page > 0) {
        drawMark(this.doc, LEFT, 30, 16, INK);
        this.doc.text(LEFT + 22, 42, wrap(title, WIDTH - 22, 8)[0] ?? '', {
          size: 8,
          color: MUTED,
        });
        this.doc.line(
          [
            [LEFT, 54],
            [RIGHT, 54],
          ],
          { stroke: RULE, width: 0.6 },
        );
      }
      this.doc.line(
        [
          [LEFT, PAGE_HEIGHT - 42],
          [RIGHT, PAGE_HEIGHT - 42],
        ],
        { stroke: RULE, width: 0.6 },
      );
      this.doc.text(LEFT, PAGE_HEIGHT - 30, 'Tesel · tesel.eu', SMALL);
      this.doc.text(RIGHT, PAGE_HEIGHT - 30, footer(page + 1, pages), { ...SMALL, align: 'end' });
    }
  }
}
