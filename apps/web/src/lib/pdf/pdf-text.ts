// Text for the standard fonts every PDF reader has, Helvetica and Helvetica-Bold, so that a PDF
// needs no font of its own (ADR-0118): written in their WinAnsiEncoding (Windows-1252, which holds
// Spanish, Catalan, French and Portuguese), and measured with their own widths to break lines.

/** Widths in thousandths of the size, of the characters from the space (32) to the tilde (126). */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
/** The first character the tables above measure. */
const FIRST = 32;

/** Windows-1252's characters between 128 and 159, where it differs from Latin-1. */
const WINDOWS: ReadonlyMap<string, number> = new Map([
  ['€', 0x80],
  ['‚', 0x82],
  ['„', 0x84],
  ['…', 0x85],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f],
]);

/** Widths, regular and bold, of the signs past 126 that are not a letter with an accent. */
const SIGNS: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['…', [1000, 1000]],
  ['—', [1000, 1000]],
  ['‰', [1000, 1000]],
  ['‘', [222, 278]],
  ['’', [222, 278]],
  ['‚', [222, 278]],
  ['“', [333, 500]],
  ['”', [333, 500]],
  ['„', [333, 500]],
  ['•', [350, 350]],
  ['·', [278, 278]],
  ['°', [400, 400]],
  ['²', [333, 333]],
  ['³', [333, 333]],
  ['¡', [333, 333]],
  ['ª', [370, 370]],
  ['º', [365, 365]],
  ['¿', [611, 611]],
  ['×', [584, 584]],
  ['‹', [333, 333]],
  ['›', [333, 333]],
  ['\u00a0', [278, 278]],
  ['Æ', [1000, 1000]],
  ['æ', [889, 889]],
  ['Œ', [1000, 1000]],
  ['œ', [944, 944]],
]);

/** Every character outside WinAnsiEncoding. */
const LACKING = new RegExp(
  `[^\\u0020-\\u007e\\u00a0-\\u00ff${[...WINDOWS.keys()].join('')}]`,
  'gu',
);

/** The circled numbers that tell apart members of the same name (ADR-0110), outside the fonts. */
const CIRCLED = /[\u2460-\u2473]/gu;

/**
 * The text as the fonts can write it: one line, circled numbers as "(2)", and every other
 * character they lack as a question mark.
 */
export function printable(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\p{Cc}\u2028\u2029]+/gu, ' ')
    .replace(CIRCLED, (sign) => `(${String((sign.codePointAt(0) ?? 0x2460) - 0x245f)})`)
    .replace(LACKING, '?');
}

/** A character's place in WinAnsiEncoding, or null for one it does not hold. */
function code(char: string): number | null {
  const point = char.codePointAt(0) ?? 0;
  if (point >= FIRST && point <= 126) return point;
  if (point >= 160 && point <= 255) return point;
  return WINDOWS.get(char) ?? null;
}

/** A PDF string of the text, in parentheses: printable bytes as they are, the rest in octal. */
export function pdfString(text: string): string {
  let out = '(';
  for (const char of printable(text)) {
    const byte = code(char) ?? 63;
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (byte < 127) out += char;
    else out += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return `${out})`;
}

function charWidth(char: string, bold: boolean): number {
  const table = bold ? BOLD : REGULAR;
  const point = char.codePointAt(0) ?? 0;
  const own = table.at(point - FIRST);
  if (point >= FIRST && point <= 126 && own !== undefined) return own;
  const sign = SIGNS.get(char);
  if (sign) return bold ? sign[1] : sign[0];
  // A letter with an accent is as wide as the letter itself.
  const base = char.normalize('NFD').charAt(0);
  if (base !== char) return charWidth(base, bold);
  return 556;
}

/** How wide the text is, in points, at a size in points. */
export function textWidth(text: string, size: number, bold = false): number {
  let width = 0;
  for (const char of printable(text)) width += charWidth(char, bold);
  return (width * size) / 1000;
}

/** The text broken into lines no wider than `width`, between words where it can. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of printable(text).split(' ')) {
    const tried = line === '' ? word : `${line} ${word}`;
    if (textWidth(tried, size, bold) <= width) {
      line = tried;
      continue;
    }
    if (line !== '') lines.push(line);
    line = word;
    // A word wider than the line is cut where it must be.
    while (textWidth(line, size, bold) > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > width) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line !== '' || lines.length === 0) lines.push(line);
  return lines;
}
