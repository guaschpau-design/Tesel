// Situation reports with a place, as GeoJSON for the map: where each is, and what happened.

import type { GroupState } from '@tesel/core';
import { eventRefKey } from '@tesel/protocol';
import type { Feature, FeatureCollection, Point } from 'geojson';

import type { Translate } from '../i18n/index.ts';
import { toPosition } from '../map/geometry.ts';
import { app6ReportSymbol } from '../objects/app6.ts';
import { app6MarkerImage, type MilitaryLook } from '../objects/app6-images.ts';
import { placePoint } from '../tasks/tasks.ts';
import { reportLines } from './report-summary.ts';

export interface ReportProperties {
  readonly key: string;
  /** What happened, as the label on the map. */
  readonly label: string;
  /** On the tactical map, the APP-6 symbol of the incident (ADR-0148); empty elsewhere. */
  readonly icon: string;
}

export function reportFeatures(
  state: Pick<GroupState, 'reports' | 'objects'>,
  t: Translate,
  military: MilitaryLook | null,
): FeatureCollection<Point, ReportProperties> {
  const features: Feature<Point, ReportProperties>[] = [];
  for (const report of state.reports) {
    const at = placePoint(report.place, state.objects);
    if (at === null) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(at) },
      properties: {
        key: eventRefKey(report),
        label: reportLines(report, t).incident,
        icon:
          military === null
            ? ''
            : app6MarkerImage(app6ReportSymbol(report.incident), military.locale),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
