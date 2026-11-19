// The map images of NATO's symbols (APP-6) for the tactical map (objects/app6.ts, ADR-0146), in
// APP-6's own colours: light fills in black frames. Drawn here, so they weigh nothing and work
// offline.

import type { Map as MapLibreMap } from 'maplibre-gl';

import type { Locale } from '../i18n/index.ts';
import { GLYPH_GRID, GLYPH_STROKE, GLYPHS } from '../ui/glyphs.ts';
import {
  app6Marker,
  app6Member,
  type App6Frame,
  type App6Framed,
  type App6Inside,
  type App6Symbol,
} from './app6.ts';
import { SYMBOLS } from './catalog.ts';
import { PROFILES } from '../members/member-catalog.ts';

const PIXEL_RATIO = 2;
/** Room for the largest frame, the installation's bar above it and the headquarters' staff below. */
const WIDTH = 60;
const HEIGHT = 84;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const INSIDE_SIZE = 18;

interface Inks {
  readonly fills: Readonly<Record<App6Frame, string>>;
  readonly line: string;
  readonly mark: string;
  readonly red: string;
  /** Behind control measures, which have no fill of their own. */
  readonly ground: string;
}

/** APP-6's light fills: crystal blue for one's own, salmon for threats, light green, light yellow. */
const INKS: Inks = {
  fills: { friend: '#80e0ff', hostile: '#ff8080', neutral: '#aaffaa', unknown: '#ffff80' },
  line: '#000000',
  mark: '#000000',
  red: '#d81e1e',
  ground: '#ffffff',
};

/** How the tactical map draws in APP-6: in which language's letters. */
export interface MilitaryLook {
  readonly locale: Locale;
}

/** The image of a marker symbol in a look and a language. */
export function app6MarkerImage(code: number, locale: Locale): string {
  return `tesel-app6-${String(code)}-${locale}`;
}

/** The image of a member's symbol: their profile, and whether they coordinate. */
export function app6MemberImage(profile: string, coordinator: boolean): string {
  return `tesel-app6-member-${profile}${coordinator ? '-hq' : ''}`;
}

/** Adds every marker symbol's image the map's style does not have yet. */
export function addApp6MarkerImages(map: MapLibreMap, locale: Locale): void {
  for (const { code } of SYMBOLS) {
    addImage(map, app6MarkerImage(code, locale), app6Marker(code), INKS, locale);
  }
}

/** Adds every member's symbol image the map's style does not have yet. */
export function addApp6MemberImages(map: MapLibreMap, locale: Locale): void {
  for (const { value } of PROFILES) {
    for (const coordinator of [false, true]) {
      addImage(
        map,
        app6MemberImage(value, coordinator),
        app6Member(value, coordinator),
        INKS,
        locale,
      );
    }
  }
}

function addImage(
  map: MapLibreMap,
  name: string,
  symbol: App6Symbol,
  inks: Inks,
  locale: Locale,
): void {
  if (map.hasImage(name)) return;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * PIXEL_RATIO;
  canvas.height = HEIGHT * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  draw(context, symbol, inks, locale);
  map.addImage(name, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}

function draw(c: CanvasRenderingContext2D, symbol: App6Symbol, inks: Inks, locale: Locale): void {
  c.strokeStyle = inks.line;
  c.lineWidth = 2;
  if (symbol.kind === 'rally') {
    c.beginPath();
    c.arc(CX, CY, 13, 0, 2 * Math.PI);
    c.fillStyle = inks.ground;
    c.fill();
    c.stroke();
    letters(c, symbol.text[locale], 11, inks.mark);
    return;
  }
  if (symbol.kind === 'landing') {
    c.beginPath();
    c.moveTo(CX - 16, CY + 12);
    c.lineTo(CX, CY - 15);
    c.lineTo(CX + 16, CY + 12);
    c.closePath();
    c.fillStyle = inks.ground;
    c.fill();
    c.stroke();
    c.save();
    c.translate(0, 4);
    letters(c, symbol.text[locale], 9.5, inks.mark);
    c.restore();
    return;
  }
  if (symbol.kind === 'framed') {
    drawFramed(c, symbol, inks, locale);
    return;
  }
  // A block across a way: a bar with its ends, and a cross where it is cut.
  c.lineWidth = 3;
  c.strokeStyle = inks.mark;
  c.beginPath();
  c.moveTo(CX - 17, CY);
  c.lineTo(CX + 17, CY);
  c.moveTo(CX - 17, CY - 8);
  c.lineTo(CX - 17, CY + 8);
  c.moveTo(CX + 17, CY - 8);
  c.lineTo(CX + 17, CY + 8);
  c.stroke();
  c.strokeStyle = inks.red;
  c.beginPath();
  c.moveTo(CX - 6, CY - 7);
  c.lineTo(CX + 6, CY + 7);
  c.moveTo(CX + 6, CY - 7);
  c.lineTo(CX - 6, CY + 7);
  c.stroke();
}

function drawFramed(
  c: CanvasRenderingContext2D,
  symbol: App6Framed,
  inks: Inks,
  locale: Locale,
): void {
  const outline = frame(symbol.frame);
  c.fillStyle = inks.fills[symbol.frame];
  c.fill(outline.path);
  c.stroke(outline.path);
  if (symbol.installation === true) {
    c.fillStyle = inks.line;
    c.fillRect(CX - 5, outline.top - 5, 10, 5);
  }
  if (symbol.headquarters === true) {
    c.beginPath();
    c.moveTo(outline.left, CY);
    c.lineTo(outline.left, outline.bottom + 16);
    c.stroke();
  }
  c.save();
  c.beginPath();
  c.clip(outline.path);
  inside(c, symbol.inside, outline, inks, locale);
  c.restore();
}

interface Outline {
  readonly path: Path2D;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** APP-6's four frames, of about the same area, around the image's middle. */
function frame(kind: App6Frame): Outline {
  if (kind === 'friend') {
    const path = new Path2D();
    path.rect(CX - 18, CY - 12, 36, 24);
    return { path, top: CY - 12, bottom: CY + 12, left: CX - 18, right: CX + 18 };
  }
  if (kind === 'hostile') {
    const path = new Path2D(
      `M${String(CX)} ${String(CY - 17)}L${String(CX + 17)} ${String(CY)}` +
        `L${String(CX)} ${String(CY + 17)}L${String(CX - 17)} ${String(CY)}Z`,
    );
    return { path, top: CY - 17, bottom: CY + 17, left: CX - 17, right: CX + 17 };
  }
  if (kind === 'neutral') {
    const path = new Path2D();
    path.rect(CX - 14, CY - 14, 28, 28);
    return { path, top: CY - 14, bottom: CY + 14, left: CX - 14, right: CX + 14 };
  }
  // Four lobes round a square: the frame of what is not known.
  const r = 8;
  const path = new Path2D(
    `M${String(CX - r)} ${String(CY - r)}a${String(r)} ${String(r)} 0 0 1 ${String(2 * r)} 0` +
      `a${String(r)} ${String(r)} 0 0 1 0 ${String(2 * r)}` +
      `a${String(r)} ${String(r)} 0 0 1 ${String(-2 * r)} 0` +
      `a${String(r)} ${String(r)} 0 0 1 0 ${String(-2 * r)}z`,
  );
  return { path, top: CY - 2 * r, bottom: CY + 2 * r, left: CX - 2 * r, right: CX + 2 * r };
}

function inside(
  c: CanvasRenderingContext2D,
  what: App6Inside,
  outline: Outline,
  inks: Inks,
  locale: Locale,
): void {
  if (what.kind === 'none') return;
  if (what.kind === 'text') {
    const text = what.text[locale];
    letters(c, text, text.length > 2 ? 9.5 : 11.5, inks.mark);
    return;
  }
  if (what.kind === 'infantry') {
    c.strokeStyle = inks.mark;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(outline.left, outline.top);
    c.lineTo(outline.right, outline.bottom);
    c.moveTo(outline.right, outline.top);
    c.lineTo(outline.left, outline.bottom);
    c.stroke();
    return;
  }
  if (what.kind === 'triangle') {
    // The international sign of civil protection: a triangle.
    c.strokeStyle = inks.mark;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(CX, CY - 8);
    c.lineTo(CX + 9, CY + 7);
    c.lineTo(CX - 9, CY + 7);
    c.closePath();
    c.stroke();
    return;
  }
  const glyph = GLYPHS[what.glyph];
  const colour = what.red === true ? inks.red : inks.mark;
  const scale = INSIDE_SIZE / GLYPH_GRID;
  c.save();
  c.translate(CX - INSIDE_SIZE / 2, CY - INSIDE_SIZE / 2);
  c.scale(scale, scale);
  c.strokeStyle = colour;
  c.fillStyle = colour;
  c.lineWidth = GLYPH_STROKE;
  for (const path of glyph.strokes) c.stroke(new Path2D(path));
  for (const path of glyph.fills) c.fill(new Path2D(path));
  c.restore();
}

function letters(c: CanvasRenderingContext2D, text: string, size: number, colour: string): void {
  c.fillStyle = colour;
  c.font = `700 ${String(size)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, CX, CY + 0.5);
}
