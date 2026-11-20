// The public services worth finding in an emergency, as the base map knows them: OpenStreetMap
// points of interest in the base map's `pois` layer, grouped into a few kinds with a pictogram and
// a colour each.

import type { LatLon } from '@tesel/protocol';
import type { ExpressionSpecification } from 'maplibre-gl';

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { Tone } from '../ui/theme.ts';

export interface ServiceKind {
  readonly id:
    'health' | 'pharmacy' | 'fire' | 'police' | 'helipad' | 'townhall' | 'fuel' | 'school';
  readonly label: MessageKey;
  readonly glyph: GlyphName;
  readonly tone: Tone;
  /** The base map's `kind` values that belong here. */
  readonly osmKinds: readonly string[];
}

export const SERVICE_KINDS: readonly [ServiceKind, ...ServiceKind[]] = [
  {
    id: 'health',
    label: 'serviceHealth',
    glyph: 'cross',
    tone: 'red',
    osmKinds: ['hospital', 'clinic', 'doctors'],
  },
  // The green cross pharmacies show in Spain and Portugal.
  {
    id: 'pharmacy',
    label: 'servicePharmacy',
    glyph: 'cross',
    tone: 'green',
    osmKinds: ['pharmacy'],
  },
  { id: 'fire', label: 'serviceFire', glyph: 'flame', tone: 'orange', osmKinds: ['fire_station'] },
  { id: 'police', label: 'servicePolice', glyph: 'shield', tone: 'blue', osmKinds: ['police'] },
  {
    id: 'helipad',
    label: 'serviceHelipad',
    glyph: 'helipad',
    tone: 'slate',
    osmKinds: ['helipad'],
  },
  // Where a municipality usually sets up its emergency coordination centre.
  {
    id: 'townhall',
    label: 'serviceTownhall',
    glyph: 'columns',
    tone: 'ink',
    osmKinds: ['townhall'],
  },
  // Fuel for vehicles and generators.
  { id: 'fuel', label: 'serviceFuel', glyph: 'fuel', tone: 'teal', osmKinds: ['fuel'] },
];

/**
 * The critical places of a town, drawn on the urban map only, and close up: a town has many
 * (ADR-0155). Where many children or young people are, and a shelter a town often opens.
 */
export const CRITICAL_PLACES: readonly [ServiceKind, ...ServiceKind[]] = [
  {
    id: 'school',
    label: 'serviceSchool',
    glyph: 'school',
    tone: 'amber',
    osmKinds: ['school', 'university'],
  },
];
export const CRITICAL_PLACES_MIN_ZOOM = 16;

/** Every kind drawn on some map. */
export const ALL_KINDS: readonly ServiceKind[] = [...SERVICE_KINDS, ...CRITICAL_PLACES];

/** A service tapped on the map: where it is, its name if the map has one, and its kind. */
export interface TappedService {
  readonly at: LatLon;
  readonly name: string | null;
  readonly kind: ServiceKind;
}

/** The kind a base map `kind` value belongs to, or undefined if it is not a service. */
export function serviceKindOf(osmKind: string): ServiceKind | undefined {
  return ALL_KINDS.find((kind) => kind.osmKinds.includes(osmKind));
}

/** Name of the map image drawn for a kind of service. */
export function serviceImageName(kind: ServiceKind): string {
  return `tesel-service-${kind.id}`;
}

/** A map expression that picks each service's image by its base map `kind`. */
export function serviceIconExpression(
  kinds: readonly [ServiceKind, ...ServiceKind[]],
): ExpressionSpecification {
  const [first, ...rest] = kinds;
  const others = rest.flatMap((kind) => [[...kind.osmKinds], serviceImageName(kind)]);
  return ['match', ['get', 'kind'], [...first.osmKinds], serviceImageName(first), ...others, ''];
}
