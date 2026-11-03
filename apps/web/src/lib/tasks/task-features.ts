// Pending tasks that have a place, as GeoJSON for the map: a task at an object is drawn where the
// object is (objects/object-anchor.ts).

import type { GroupState } from '@tesel/core';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { toPosition } from '../map/geometry.ts';
import { shorten, shownText } from '../text.ts';
import { isPending, placePoint } from './tasks.ts';

/** Longer texts are cut on the map; the whole text is in the tasks panel. */
const LABEL_LENGTH = 28;

export interface TaskProperties {
  /** The task reference's key, used to open the task. */
  readonly key: string;
  readonly label: string;
  readonly started: boolean;
}

export function taskFeatures(
  state: Pick<GroupState, 'tasks' | 'objects'>,
): FeatureCollection<Point, TaskProperties> {
  const features: Feature<Point, TaskProperties>[] = [];
  for (const [key, task] of state.tasks) {
    const at = placePoint(task.place, state.objects);
    if (at === null || !isPending(task.status)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(at) },
      properties: {
        key,
        label: shorten(shownText(task.text), LABEL_LENGTH),
        started: task.status === 'in-progress',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
