// Where members have been, as GeoJSON lines for the map: one per member who has travelled
// between two places, this device's own included. Only real moves are drawn, not the GPS
// wandering (position/movement.ts).

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import type { Feature, FeatureCollection, LineString } from 'geojson';

import { travelled } from '../position/movement.ts';

export interface TrailProperties {
  readonly self: boolean;
}

export function trailFeatures(
  state: Pick<GroupState, 'trails'>,
  self: NodeId,
): FeatureCollection<LineString, TrailProperties> {
  const features: Feature<LineString, TrailProperties>[] = [];
  for (const [origin, trail] of state.trails) {
    const points = travelled(trail.points);
    if (points.length < 2) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) },
      properties: { self: origin === self },
    });
  }
  return { type: 'FeatureCollection', features };
}
