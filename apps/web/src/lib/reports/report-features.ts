// Situation reports with a place, as GeoJSON for the map: where each is, and what happened.

import type { GroupState } from '@tesel/core';
import { eventRefKey } from '@tesel/protocol';
import type { Feature, FeatureCollection, Point } from 'geojson';

import type { Translate } from '../i18n/index.ts';
import { toPosition } from '../map/geometry.ts';
import { placePoint } from '../tasks/tasks.ts';
import { reportLines } from './report-summary.ts';

export interface ReportProperties {
  readonly key: string;
  /** What happened, as the label on the map. */
  readonly label: string;
}

export function reportFeatures(
  state: Pick<GroupState, 'reports' | 'objects'>,
  t: Translate,
): FeatureCollection<Point, ReportProperties> {
  const features: Feature<Point, ReportProperties>[] = [];
  for (const report of state.reports) {
    const at = placePoint(report.place, state.objects);
    if (at === null) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(at) },
      properties: { key: eventRefKey(report), label: reportLines(report, t).incident },
    });
  }
  return { type: 'FeatureCollection', features };
}
