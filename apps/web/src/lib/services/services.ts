// The public services worth finding in an emergency, as the base map knows them: OpenStreetMap
// points of interest in the base map's `pois` layer, grouped into a few kinds with a pictogram and
// a colour each.

import type { LatLon } from '@tesel/protocol';
import type { ExpressionSpecification } from 'maplibre-gl';

import type { MessageKey } from '../i18n/index.ts';
import { app6ServiceImage } from '../objects/app6-images.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { Tone } from '../ui/theme.ts';

export interface ServiceKind {
  readonly id: 'health' | 'pharmacy' | 'fire' | 'police' | 'helipad' | 'townhall' | 'fuel';
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

/** A service tapped on the map: where it is, its name if the map has one, and its kind. */
export interface TappedService {
  readonly at: LatLon;
  readonly name: string | null;
  readonly kind: ServiceKind;
}

/** The kind a base map `kind` value belongs to, or undefined if it is not a service. */
export function serviceKindOf(osmKind: string): ServiceKind | undefined {
  return SERVICE_KINDS.find((kind) => kind.osmKinds.includes(osmKind));
}

/**
 * How services are drawn: round icons in each kind's colour, or, on the tactical map, APP-6's
 * civil installations (ADR-0148).
 */
export type ServiceLook = 'round' | 'app6';

/** Name of the map image drawn for a kind of service in a look. */
export function serviceImageName(kind: ServiceKind, look: ServiceLook): string {
  return look === 'app6' ? app6ServiceImage(kind.id) : `tesel-service-${kind.id}`;
}

/** A map expression that picks each service's image by its base map `kind`. */
export function serviceIconExpression(look: ServiceLook): ExpressionSpecification {
  const [first, ...rest] = SERVICE_KINDS;
  const others = rest.flatMap((kind) => [[...kind.osmKinds], serviceImageName(kind, look)]);
  return [
    'match',
    ['get', 'kind'],
    [...first.osmKinds],
    serviceImageName(first, look),
    ...others,
    '',
  ];
}
