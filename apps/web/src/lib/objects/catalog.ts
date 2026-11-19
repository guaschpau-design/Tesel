// How marker symbols and shape styles (protocol §4) look in this app: a pictogram (ui/glyphs.ts) and
// a family of colour (app.css). Unknown codes fall back to the generic symbol and the neutral
// style, as the protocol requires.

import {
  ShapeStyleCode,
  SymbolCode,
  type MarkerEvent,
  type ShapeEvent,
  type SweepEvent,
} from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { Tone } from '../ui/theme.ts';
import type { GlyphName } from '../ui/glyphs.ts';

export interface SymbolInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly glyph: GlyphName;
  readonly tone: Tone;
}

// Families: people and health in red, hazards in orange and amber, water in blue, safety and
// logistics in green, command in ink.
/** Also what a symbol this version does not know is drawn as (protocol §3.1, reserved values). */
const GENERIC_SYMBOL: SymbolInfo = {
  code: SymbolCode.GENERIC,
  label: 'symbolGeneric',
  glyph: 'point',
  tone: 'slate',
};

/** In the order they are offered: the plain point first, then the most used. */
export const SYMBOLS: readonly SymbolInfo[] = [
  GENERIC_SYMBOL,
  { code: SymbolCode.INJURED, label: 'symbolInjured', glyph: 'injured', tone: 'red' },
  { code: SymbolCode.MISSING, label: 'symbolMissing', glyph: 'search', tone: 'red' },
  { code: SymbolCode.HAZARD, label: 'symbolHazard', glyph: 'warning', tone: 'amber' },
  { code: SymbolCode.FIRE, label: 'symbolFire', glyph: 'flame', tone: 'orange' },
  { code: SymbolCode.FLOOD, label: 'symbolFlood', glyph: 'waves', tone: 'blue' },
  { code: SymbolCode.BLOCKED_ROAD, label: 'symbolBlockedRoad', glyph: 'barrier', tone: 'amber' },
  { code: SymbolCode.MEETING_POINT, label: 'symbolMeetingPoint', glyph: 'flag', tone: 'green' },
  { code: SymbolCode.MEDICAL_POST, label: 'symbolMedicalPost', glyph: 'cross', tone: 'red' },
  { code: SymbolCode.SHELTER, label: 'symbolShelter', glyph: 'house', tone: 'green' },
  { code: SymbolCode.WATER, label: 'symbolWater', glyph: 'drop', tone: 'blue' },
  { code: SymbolCode.HELICOPTER, label: 'symbolHelicopter', glyph: 'helipad', tone: 'green' },
  { code: SymbolCode.COMMAND_POST, label: 'symbolCommandPost', glyph: 'mast', tone: 'ink' },
];

/** The symbols of threats: what a decluttered map keeps of the markers (ADR-0151). */
const THREATS: ReadonlySet<number> = new Set([
  SymbolCode.FIRE,
  SymbolCode.FLOOD,
  SymbolCode.HAZARD,
  SymbolCode.BLOCKED_ROAD,
]);

export function isThreat(code: number): boolean {
  return THREATS.has(code);
}

export interface StyleInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly tone: Tone;
}

/** Also what a style this version does not know is drawn as. */
const NEUTRAL_STYLE: StyleInfo = {
  code: ShapeStyleCode.NEUTRAL,
  label: 'styleNeutral',
  tone: 'slate',
};

const SHAPE_STYLES: readonly StyleInfo[] = [
  NEUTRAL_STYLE,
  { code: ShapeStyleCode.DANGER, label: 'styleDanger', tone: 'red' },
  { code: ShapeStyleCode.SEARCH_ASSIGNED, label: 'styleSearchAssigned', tone: 'amber' },
  { code: ShapeStyleCode.SEARCH_CLEARED, label: 'styleSearchCleared', tone: 'green' },
  { code: ShapeStyleCode.SAFE, label: 'styleSafe', tone: 'teal' },
  { code: ShapeStyleCode.ROUTE, label: 'styleRoute', tone: 'blue' },
  { code: ShapeStyleCode.OPERATION_AREA, label: 'styleOperationArea', tone: 'ink' },
];

/**
 * The styles offered when drawing an area: all but the route, which is for lines, and the
 * operation area only for coordinators (a UI rule, like alerts: ADR-0005).
 */
export function areaStyles(coordinator: boolean): StyleInfo[] {
  return SHAPE_STYLES.filter(
    (style) =>
      style.code !== ShapeStyleCode.ROUTE &&
      (coordinator || style.code !== ShapeStyleCode.OPERATION_AREA),
  );
}

export function symbolInfo(code: number): SymbolInfo {
  return SYMBOLS.find((symbol) => symbol.code === code) ?? GENERIC_SYMBOL;
}

export function styleInfo(code: number): StyleInfo {
  return SHAPE_STYLES.find((style) => style.code === code) ?? NEUTRAL_STYLE;
}

/** Name of the map image drawn for a symbol (see symbol-images.ts). */
export function symbolImageName(code: number): string {
  return `tesel-symbol-${String(symbolInfo(code).code)}`;
}

/** The name of what an object is: its symbol, its style, or a strip of a sweep. */
export function objectKind(object: MarkerEvent | ShapeEvent | SweepEvent): MessageKey {
  switch (object.type) {
    case 'marker':
      return symbolInfo(object.symbol).label;
    case 'shape':
      return styleInfo(object.style).label;
    case 'sweep':
      return 'sweepStrip';
  }
}
