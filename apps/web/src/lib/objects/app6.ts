// What NATO's symbology (APP-6) draws for each marker and each member on the tactical maps
// (ADR-0146). Only the drawing changes: what is marked and sent is the same, so members on other
// maps see the app's own icons for the same markers. A frame says what something is to the team:
// its own (a rectangle), a threat (a diamond), unknown (a quatrefoil) or neutral (a square); a bar
// on top marks an installation, a staff below a headquarters. Points that are no unit nor
// installation are control measures with their own marks.

import { SymbolCode, type Profile } from '@tesel/protocol';

import type { Locale } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';

export type App6Frame = 'friend' | 'hostile' | 'unknown' | 'neutral';

/** What is drawn inside a frame: a pictogram, letters, or the infantry's crossed lines. */
export type App6Inside =
  | { readonly kind: 'glyph'; readonly glyph: GlyphName; readonly red?: boolean }
  | { readonly kind: 'text'; readonly text: Readonly<Record<Locale, string>> }
  | { readonly kind: 'infantry' }
  | { readonly kind: 'triangle' }
  | { readonly kind: 'none' };

/** A unit, installation or threat in its frame. */
export interface App6Framed {
  readonly kind: 'framed';
  readonly frame: App6Frame;
  readonly inside: App6Inside;
  readonly installation?: boolean;
  readonly headquarters?: boolean;
}

/** A control measure: a rally point, a landing zone, a block across a way. */
interface App6Control {
  readonly kind: 'rally' | 'landing' | 'block';
  readonly text: Readonly<Record<Locale, string>>;
}

export type App6Symbol = App6Framed | App6Control;

const NONE: App6Inside = { kind: 'none' };
const same = (text: string): Readonly<Record<Locale, string>> => ({ es: text, en: text });

/** Each marker symbol (protocol §4.1), as APP-6 draws it. */
const MARKERS: Readonly<Record<number, App6Symbol>> = {
  [SymbolCode.GENERIC]: { kind: 'framed', frame: 'neutral', inside: NONE },
  [SymbolCode.INJURED]: {
    kind: 'framed',
    frame: 'friend',
    inside: { kind: 'glyph', glyph: 'cross', red: true },
  },
  [SymbolCode.MISSING]: {
    kind: 'framed',
    frame: 'unknown',
    inside: { kind: 'glyph', glyph: 'person' },
  },
  [SymbolCode.FIRE]: {
    kind: 'framed',
    frame: 'hostile',
    inside: { kind: 'glyph', glyph: 'flame' },
  },
  [SymbolCode.FLOOD]: {
    kind: 'framed',
    frame: 'hostile',
    inside: { kind: 'glyph', glyph: 'waves' },
  },
  [SymbolCode.HAZARD]: {
    kind: 'framed',
    frame: 'hostile',
    inside: { kind: 'text', text: same('!') },
  },
  [SymbolCode.BLOCKED_ROAD]: { kind: 'block', text: same('') },
  [SymbolCode.SHELTER]: {
    kind: 'framed',
    frame: 'friend',
    inside: { kind: 'glyph', glyph: 'house' },
    installation: true,
  },
  [SymbolCode.MEETING_POINT]: { kind: 'rally', text: { es: 'PR', en: 'RP' } },
  [SymbolCode.MEDICAL_POST]: {
    kind: 'framed',
    frame: 'friend',
    inside: { kind: 'glyph', glyph: 'cross', red: true },
    installation: true,
  },
  [SymbolCode.WATER]: {
    kind: 'framed',
    frame: 'friend',
    inside: { kind: 'text', text: same('W') },
    installation: true,
  },
  [SymbolCode.HELICOPTER]: { kind: 'landing', text: same('LZ') },
  [SymbolCode.COMMAND_POST]: {
    kind: 'framed',
    frame: 'friend',
    inside: { kind: 'text', text: { es: 'PC', en: 'CP' } },
    headquarters: true,
  },
};

/** What a marker symbol is drawn as; an unknown code as the generic one. */
export function app6Marker(code: number): App6Symbol {
  return MARKERS[code] ?? { kind: 'framed', frame: 'neutral', inside: NONE };
}

/** What each profile's members are drawn with inside their frame. */
const PROFILES: Readonly<Record<Profile, App6Inside>> = {
  police: { kind: 'text', text: same('LE') },
  'civil-protection': { kind: 'triangle' },
  firefighters: { kind: 'glyph', glyph: 'flame' },
  medical: { kind: 'glyph', glyph: 'cross', red: true },
  rescue: { kind: 'text', text: same('SAR') },
  volunteer: NONE,
  military: { kind: 'infantry' },
  other: NONE,
  unspecified: NONE,
};

/** A member of the team: their own frame, what their profile does inside it, a staff if they coordinate. */
export function app6Member(profile: Profile, coordinator: boolean): App6Framed {
  return { kind: 'framed', frame: 'friend', inside: PROFILES[profile], headquarters: coordinator };
}
