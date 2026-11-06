// A small PDF writer for documents of text and lines on A4 pages (ADR-0118): enough for the
// report of an operation, with no library. Positions are in points from the page's top left, as a
// page is read; the file is plain ASCII, so it can be handed over as a string.

import { pdfString } from './pdf-text.ts';

/** A4, in points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

/** A colour as red, green and blue from 0 to 1. */
export type Rgb = readonly [number, number, number];

export interface TextStyle {
  /** In points. */
  readonly size: number;
  readonly bold?: boolean;
  readonly color?: Rgb;
}

export interface DocumentInfo {
  readonly title: string;
  /** When it was made, in milliseconds. */
  readonly made: number;
}

const BLACK: Rgb = [0, 0, 0];

export class PdfDocument {
  readonly #pages: string[][] = [];
  #page = -1;

  /** Starts a new page and writes on it from now on. */
  addPage(): void {
    this.#pages.push([]);
    this.#page = this.#pages.length - 1;
  }

  get pageCount(): number {
    return this.#pages.length;
  }

  /** Writes on an earlier page, by its number from 0, as a footer is written once all are known. */
  turnTo(page: number): void {
    if (page < 0 || page >= this.#pages.length) throw new RangeError(`No page ${String(page)}`);
    this.#page = page;
  }

  /** One line of text, its baseline `y` points from the top. */
  text(x: number, y: number, text: string, style: TextStyle): void {
    const font = style.bold === true ? 'F2' : 'F1';
    this.#write(
      `BT /${font} ${num(style.size)} Tf ${rgb(style.color ?? BLACK)} rg ` +
        `1 0 0 1 ${num(x)} ${num(PAGE_HEIGHT - y)} Tm ${pdfString(text)} Tj ET`,
    );
  }

  /** A straight line `y` points from the top. */
  rule(x1: number, x2: number, y: number, color: Rgb, width: number): void {
    const at = num(PAGE_HEIGHT - y);
    this.#write(`${rgb(color)} RG ${num(width)} w ${num(x1)} ${at} m ${num(x2)} ${at} l S`);
  }

  /** The finished file. */
  file(info: DocumentInfo): string {
    if (this.#pages.length === 0) this.addPage();
    const objects: string[] = [];
    const add = (body: string): number => objects.push(body);
    const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
    add(''); // The page tree, written below once its pages are numbered.
    const regular = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    );
    const bold = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    );
    const fonts = `<< /F1 ${String(regular)} 0 R /F2 ${String(bold)} 0 R >>`;
    const kids = this.#pages.map((operations) => {
      const content = operations.join('\n');
      const stream = add(`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`);
      return add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] ` +
          `/Resources << /Font ${fonts} >> /Contents ${String(stream)} 0 R >>`,
      );
    });
    objects[1] =
      `<< /Type /Pages /Kids [${kids.map((kid) => `${String(kid)} 0 R`).join(' ')}] ` +
      `/Count ${String(kids.length)} >>`;
    const meta = add(
      `<< /Title ${pdfString(info.title)} /Producer (Tesel) /CreationDate (${pdfDate(info.made)}) >>`,
    );

    let out = '%PDF-1.4\n';
    const offsets = objects.map((body, index) => {
      const offset = out.length;
      out += `${String(index + 1)} 0 obj\n${body}\nendobj\n`;
      return offset;
    });
    const xref = out.length;
    out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
    out +=
      `trailer\n<< /Size ${String(objects.length + 1)} /Root ${String(catalog)} 0 R ` +
      `/Info ${String(meta)} 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
    return out;
  }

  #write(operation: string): void {
    if (this.#page < 0) this.addPage();
    this.#pages.at(this.#page)?.push(operation);
  }
}

/** A number as PDF writes it: at most two decimals, no exponent. */
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function rgb([red, green, blue]: Rgb): string {
  return `${num(red)} ${num(green)} ${num(blue)}`;
}

/** PDF's date: D:YYYYMMDDHHmmSSZ, in UTC. */
function pdfDate(time: number): string {
  const iso = new Date(time).toISOString();
  return `D:${iso.slice(0, 19).replace(/[-:T]/g, '')}Z`;
}
