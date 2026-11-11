// A small PDF writer for documents of text and drawings on A4 pages (ADR-0118): enough for the
// debrief of an operation, with no library. Positions are in points from the page's top left, as
// a page is read; the file is plain ASCII, so it can be handed over as a string.

import { pdfString, printable, textWidth } from './pdf-text.ts';
import { svgPathOperators } from './svg-path.ts';

/** A4, in points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

/** A colour as red, green and blue from 0 to 1. */
export type Rgb = readonly [number, number, number];
export type Point = readonly [number, number];

export interface TextStyle {
  /** In points. */
  readonly size: number;
  readonly bold?: boolean;
  readonly color?: Rgb;
  /** Where `x` is: at the start of the text (the default), its end or its middle. */
  readonly align?: 'start' | 'end' | 'middle';
  /** Extra points between letters, as in a spaced-out label. */
  readonly spacing?: number;
}

/** How a shape is painted: filled, outlined or both. */
export interface Paint {
  readonly fill?: Rgb;
  readonly stroke?: Rgb;
  /** The outline's width in points; 1 by default. */
  readonly width?: number;
  /** Dashes and gaps in points, for a dashed outline. */
  readonly dash?: readonly number[];
}

/** An SVG drawing placed on the page: its top left at (x, y), its units `scale` points each. */
export interface SvgPlacement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface SvgShape {
  readonly d: string;
  readonly fill: Rgb;
}

export interface DocumentInfo {
  readonly title: string;
  /** When it was made, in milliseconds. */
  readonly made: number;
}

const BLACK: Rgb = [0, 0, 0];
/** How far along a quarter circle a Bézier curve puts its control points. */
const KAPPA = 0.5523;

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
    const spacing = style.spacing ?? 0;
    const width = textWidth(text, style.size, style.bold) + spacing * printable(text).length;
    const start = style.align === 'end' ? x - width : style.align === 'middle' ? x - width / 2 : x;
    this.#write(
      `BT /${font} ${num(style.size)} Tf ${num(spacing)} Tc ${rgb(style.color ?? BLACK)} rg ` +
        `1 0 0 1 ${num(start)} ${num(PAGE_HEIGHT - y)} Tm ${pdfString(text)} Tj ET`,
    );
  }

  /** A line through the points, open. */
  line(points: readonly Point[], paint: Paint): void {
    this.#shape(this.#trace(points), paint, true);
  }

  /** A closed shape through the points. */
  polygon(points: readonly Point[], paint: Paint): void {
    this.#shape(`${this.#trace(points)} h`, paint);
  }

  /** A rectangle, its top left at (x, y), with rounded corners of `radius`. */
  rect(x: number, y: number, width: number, height: number, paint: Paint, radius = 0): void {
    const r = Math.min(radius, width / 2, height / 2);
    if (r <= 0) {
      this.#shape(
        `${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re`,
        paint,
      );
      return;
    }
    const left = x;
    const right = x + width;
    const top = PAGE_HEIGHT - y;
    const bottom = top - height;
    const k = r * (1 - KAPPA);
    this.#shape(
      [
        `${num(left + r)} ${num(top)} m ${num(right - r)} ${num(top)} l`,
        `${num(right - k)} ${num(top)} ${num(right)} ${num(top - k)} ${num(right)} ${num(top - r)} c`,
        `${num(right)} ${num(bottom + r)} l`,
        `${num(right)} ${num(bottom + k)} ${num(right - k)} ${num(bottom)} ${num(right - r)} ${num(bottom)} c`,
        `${num(left + r)} ${num(bottom)} l`,
        `${num(left + k)} ${num(bottom)} ${num(left)} ${num(bottom + k)} ${num(left)} ${num(bottom + r)} c`,
        `${num(left)} ${num(top - r)} l`,
        `${num(left)} ${num(top - k)} ${num(left + k)} ${num(top)} ${num(left + r)} ${num(top)} c h`,
      ].join(' '),
      paint,
    );
  }

  circle(cx: number, cy: number, radius: number, paint: Paint): void {
    const x = cx;
    const y = PAGE_HEIGHT - cy;
    const r = radius;
    const k = r * KAPPA;
    this.#shape(
      [
        `${num(x + r)} ${num(y)} m`,
        `${num(x + r)} ${num(y + k)} ${num(x + k)} ${num(y + r)} ${num(x)} ${num(y + r)} c`,
        `${num(x - k)} ${num(y + r)} ${num(x - r)} ${num(y + k)} ${num(x - r)} ${num(y)} c`,
        `${num(x - r)} ${num(y - k)} ${num(x - k)} ${num(y - r)} ${num(x)} ${num(y - r)} c`,
        `${num(x + k)} ${num(y - r)} ${num(x + r)} ${num(y - k)} ${num(x + r)} ${num(y)} c h`,
      ].join(' '),
      paint,
    );
  }

  /** Draws what `draw` draws, cut to a rectangle whose top left is at (x, y). */
  clipped(x: number, y: number, width: number, height: number, draw: () => void): void {
    this.#write(`q ${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re W n`);
    draw();
    this.#write('Q');
  }

  /** Shapes drawn as SVG paths, in the SVG's own units and directions. */
  svg(at: SvgPlacement, shapes: readonly SvgShape[]): void {
    const ops = [
      'q',
      `${num(at.scale)} 0 0 ${num(-at.scale)} ${num(at.x)} ${num(PAGE_HEIGHT - at.y)} cm`,
    ];
    for (const shape of shapes) ops.push(`${rgb(shape.fill)} rg ${svgPathOperators(shape.d)} f`);
    ops.push('Q');
    this.#write(ops.join('\n'));
  }

  /** The finished file. */
  file(info: DocumentInfo): string {
    if (this.#pages.length === 0) this.addPage();
    const objects: string[] = [];
    const add = (body: string): number => objects.push(body);
    const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
    add(''); // The page tree, written below once its pages are numbered.
    const font = (name: string) =>
      add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
    const regular = font('Helvetica');
    const bold = font('Helvetica-Bold');
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

  /** The operators that trace a line through the points, from the top-left origin. */
  #trace(points: readonly Point[]): string {
    return points
      .map(([x, y], index) => `${num(x)} ${num(PAGE_HEIGHT - y)} ${index === 0 ? 'm' : 'l'}`)
      .join(' ');
  }

  /** Paints a traced path; an open one is only ever outlined. */
  #shape(path: string, paint: Paint, open = false): void {
    const fill = open ? undefined : paint.fill;
    if (fill === undefined && paint.stroke === undefined) return;
    const set: string[] = [];
    if (fill) set.push(`${rgb(fill)} rg`);
    if (paint.stroke) {
      set.push(`${rgb(paint.stroke)} RG ${num(paint.width ?? 1)} w 1 j 1 J`);
      set.push(`[${(paint.dash ?? []).map(num).join(' ')}] 0 d`);
    }
    const op = fill && paint.stroke ? 'B' : fill ? 'f' : 'S';
    this.#write(`q ${set.join(' ')} ${path} ${op} Q`);
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

/** A number for a transformation, with the precision a rotation needs. */
function fine(value: number): string {
  return String(Math.round(value * 1e5) / 1e5);
}

function rgb([red, green, blue]: Rgb): string {
  return `${fine(red)} ${fine(green)} ${fine(blue)}`;
}

/** PDF's date: D:YYYYMMDDHHmmSSZ, in UTC. */
function pdfDate(time: number): string {
  const iso = new Date(time).toISOString();
  return `D:${iso.slice(0, 19).replace(/[-:T]/g, '')}Z`;
}
