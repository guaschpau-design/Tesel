// The aid points of the app's server (ADR-0165): defibrillators, fire hydrants and drinking water,
// OpenStreetMap's, in an archive the server builds every week (apps/server/src/maps/
// build-aid-points.ts) and the app downloads with each area. ServicesLayer draws them.

import type { SourceSpecification } from 'maplibre-gl';

import { tileUrlTemplate } from '../map/tiles/protocol.ts';
import {
  AID_POINTS_ATTRIBUTION,
  AID_POINTS_MAX_ZOOM,
  AID_POINTS_MIN_ZOOM,
} from '../map/tiles/sources.ts';
import type { AidFacts } from './services.ts';

export const AID_SOURCE = 'aid-points';
/** The archive's layer. */
export const AID_LAYER = 'point';

export function aidPointsSource(): SourceSpecification {
  return {
    type: 'vector',
    tiles: [tileUrlTemplate('aid-points')],
    minzoom: AID_POINTS_MIN_ZOOM,
    maxzoom: AID_POINTS_MAX_ZOOM,
    attribution: AID_POINTS_ATTRIBUTION,
  };
}

/** What the archive tells of a point, from its properties. */
export function aidFacts(properties: Readonly<Record<string, unknown>>): AidFacts {
  const text = (name: string) => {
    const value = properties[name];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  };
  return { where: text('where'), hours: text('hours'), access: text('access'), type: text('type') };
}
