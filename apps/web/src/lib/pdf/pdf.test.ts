import { describe, expect, it } from 'vitest';

import { PAGE_HEIGHT, PdfDocument } from './pdf-document.ts';
import { pdfString, printable, textWidth, wrap } from './pdf-text.ts';

describe('text for the standard fonts', () => {
  it('writes accents in the fonts’ encoding, escapes what PDF reads as syntax', () => {
    expect(pdfString('Año (señal) \\ «€»')).toBe('(A\\361o \\(se\\361al\\) \\\\ \\253\\200\\273)');
  });

  it('keeps to one line, numbers members of the same name and marks what the fonts lack', () => {
    expect(printable('Marta ②\nsigue')).toBe('Marta (2) sigue');
    expect(printable('Вода 🚑')).toBe('???? ?');
  });

  it('measures with the fonts’ widths, an accented letter as its letter', () => {
    expect(textWidth('Hola', 10)).toBeCloseTo(20.56, 2);
    expect(textWidth('á', 10)).toBe(textWidth('a', 10));
    expect(textWidth('Hola', 10, true)).toBeGreaterThan(textWidth('Hola', 10));
  });

  it('breaks lines between words, and cuts a word wider than the line', () => {
    const lines = wrap('Revisar la zona norte del barranco antes de que anochezca', 120, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const each of lines) expect(textWidth(each, 10)).toBeLessThanOrEqual(120);
    expect(lines.join(' ')).toBe('Revisar la zona norte del barranco antes de que anochezca');
    expect(wrap('x'.repeat(100), 50, 10).every((each) => textWidth(each, 10) <= 50)).toBe(true);
    expect(wrap('', 50, 10)).toEqual(['']);
  });
});

describe('a PDF document', () => {
  it('is a file whose cross-reference table points at each of its objects', () => {
    const doc = new PdfDocument();
    doc.text(56, 64, 'Primera página', { size: 12 });
    doc.addPage();
    doc.line(
      [
        [56, 100],
        [200, 100],
      ],
      { stroke: [0.6, 0.79, 0.22], width: 2 },
    );
    const file = doc.file({ title: 'Prueba', made: Date.UTC(2026, 10, 6, 9, 0) });

    expect(doc.pageCount).toBe(2);
    expect(file).toMatch(/^[\t\n -~]*$/);
    expect(file).toContain('/Count 2');
    expect(file).toContain(`1 0 0 1 56 ${String(Math.round((PAGE_HEIGHT - 64) * 100) / 100)} Tm`);
    expect(file).toContain('/CreationDate (D:20261106090000Z)');

    const start = Number(/startxref\n(\d+)/.exec(file)?.[1]);
    expect(file.slice(start, start + 4)).toBe('xref');
    const offsets = [...file.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
      Number(match[1]),
    );
    offsets.forEach((offset, index) => {
      expect(file.slice(offset)).toMatch(new RegExp(`^${String(index + 1)} 0 obj\\n`));
    });
  });

  it('says how long each page’s content is', () => {
    const doc = new PdfDocument();
    doc.text(56, 64, 'Hola', { size: 10, bold: true });
    const file = doc.file({ title: 'Prueba', made: 0 });
    const match = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(file);
    expect(match?.[2]?.length).toBe(Number(match?.[1]));
  });

  it('turns back to an earlier page, and only to one it has', () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.addPage();
    doc.turnTo(0);
    expect(() => {
      doc.turnTo(2);
    }).toThrow(RangeError);
  });
});
