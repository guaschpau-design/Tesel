// A map object being drawn: the points tapped so far and what they will become.

import {
  SHAPE_MAX_POINTS,
  type LatLon,
  type MarkerEvent,
  type ShapeEvent,
  type ShapeGeometry,
} from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import { densify } from './shape-points.ts';

/** What can be drawn: a marker, a route or an area. Circles drawn by older versions still show. */
export type DraftKind = 'marker' | 'route' | 'area';

/** What kind of drawing a marker or a shape of the map is, to change it as it was drawn. */
export function draftKindOf(object: MarkerEvent | ShapeEvent): DraftKind {
  if (object.type === 'marker') return 'marker';
  return object.geometry.kind === 'polyline' ? 'route' : 'area';
}

/** What each kind is called, in the "Add" menu and once sent. */
export const DRAFT_NAMES: Readonly<Record<DraftKind, MessageKey>> = {
  marker: 'drawMarker',
  route: 'drawRoute',
  area: 'drawArea',
};

export const DRAFT_TITLES: Readonly<Record<DraftKind, MessageKey>> = {
  marker: 'newMarker',
  route: 'newRoute',
  area: 'newArea',
};

export interface Draft {
  readonly kind: DraftKind;
  /** Marker: its point. Route: its points in order. Area: its corners. */
  readonly points: readonly LatLon[];
}

const NEEDED: Readonly<Record<DraftKind, number>> = { marker: 1, route: 2, area: 3 };
const MAXIMUM: Readonly<Record<DraftKind, number>> = {
  marker: 1,
  route: SHAPE_MAX_POINTS,
  area: SHAPE_MAX_POINTS,
};

export function startDraft(kind: DraftKind): Draft {
  return { kind, points: [] };
}

/** Adds a tapped point; a draft that cannot take more points is returned unchanged. */
export function addPoint(draft: Draft, at: LatLon): Draft {
  if (draft.points.length >= MAXIMUM[draft.kind]) return draft;
  return { ...draft, points: [...draft.points, at] };
}

export function undoPoint(draft: Draft): Draft {
  return { ...draft, points: draft.points.slice(0, -1) };
}

export function isComplete(draft: Draft): boolean {
  return draft.points.length >= NEEDED[draft.kind];
}

/** True once no more points can be added: the object is ready to be described and saved. */
export function isFull(draft: Draft): boolean {
  return draft.points.length >= MAXIMUM[draft.kind];
}

/**
 * The line or polygon a complete route or area describes, with points added where taps are too
 * far apart to send. Null for markers, unfinished ones and those too long to send (`fits`).
 */
export function draftGeometry(draft: Draft): ShapeGeometry | null {
  if (draft.kind === 'marker' || !isComplete(draft) || !fits(draft)) return null;
  const points = densify(draft.points);
  return { kind: draft.kind === 'route' ? 'polyline' : 'polygon', points };
}

/**
 * Whether the draft can be sent: a route or an area spread so wide that the points it needs
 * would be too many cannot.
 */
export function fits(draft: Draft): boolean {
  return draft.kind === 'marker' || densify(draft.points).length <= SHAPE_MAX_POINTS;
}
