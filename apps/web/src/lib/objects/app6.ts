// What NATO's symbology (APP-6) draws on the tactical map (ADR-0146, ADR-0148): each marker,
// member, service, task, report and this device. Only the drawing changes: what is marked and
// sent is the same, so members on other maps see the app's own icons for the same things. A frame says what something is to the team:
// its own (a rectangle), a threat (a diamond), unknown (a quatrefoil) or neutral (a square); a bar
// on top marks an installation, a staff below a headquarters. Points that are no unit nor
// installation are control measures with their own marks.

import { SymbolCode, type IncidentType, type Profile } from '@tesel/protocol';

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
  /** This device among the team: a yellow edge round its frame. */
  readonly highlight?: boolean;
}

/**
 * A control measure: a rally point, a landing zone, a block across a way, an objective (a task's
 * place); `started` fills an objective someone works on.
 */
interface App6Control {
  readonly kind: 'rally' | 'landing' | 'block' | 'objective';
  readonly text: Readonly<Record<Locale, string>>;
  readonly started?: boolean;
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

/**
 * The base map's public services (services/services.ts): civil installations, neither the team's
 * nor a threat, in a neutral frame with their pictogram; a helipad is a landing zone.
 */
export function app6Service(kind: string, glyph: GlyphName): App6Symbol {
  if (kind === 'helipad') return { kind: 'landing', text: same('LZ') };
  return {
    kind: 'framed',
    frame: 'neutral',
    inside: { kind: 'glyph', glyph, red: kind === 'health' },
    installation: true,
  };
}

/** A task's place: an objective, filled once someone is working on it. */
export function app6Objective(started: boolean): App6Symbol {
  return { kind: 'objective', text: same('OBJ'), started };
}

/** This device: its own frame, edged in yellow, with "TÚ". */
export const APP6_SELF: App6Framed = {
  kind: 'framed',
  frame: 'friend',
  inside: { kind: 'text', text: { es: 'TÚ', en: 'YOU' } },
  highlight: true,
};

/** A field report's incident as the marker of the same thing (protocol §3.16). */
const INCIDENTS: Readonly<Record<IncidentType, number>> = {
  other: SymbolCode.GENERIC,
  fire: SymbolCode.FIRE,
  flood: SymbolCode.FLOOD,
  'traffic-accident': SymbolCode.HAZARD,
  collapse: SymbolCode.HAZARD,
  'missing-person': SymbolCode.MISSING,
  rescue: SymbolCode.INJURED,
  'hazardous-materials': SymbolCode.HAZARD,
  medical: SymbolCode.INJURED,
};

/** The marker symbol a report of an incident is drawn as. */
export function app6ReportSymbol(incident: IncidentType): number {
  return INCIDENTS[incident];
}
