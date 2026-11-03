// What the app calls a map object, wherever it names one: a panel's title, a task's place, a line
// of the diary. A strip of a sweep is named by its area and its place among the strips. Labels are
// shown without the characters no one sees (ADR-0110).

import type { GroupState } from '@tesel/core';
import { eventRefKey, type MarkerEvent, type ShapeEvent, type SweepEvent } from '@tesel/protocol';

import type { Translate } from '../i18n/index.ts';
import { shownText } from '../text.ts';
import { objectKind } from './catalog.ts';

type MapObject = MarkerEvent | ShapeEvent | SweepEvent;

/** Its label, or else what it is. */
export function objectTitle(
  object: MapObject,
  objects: GroupState['objects'],
  t: Translate,
): string {
  if (object.type === 'sweep') return stripName(object, objects, t);
  return shownText(object.label) || t(objectKind(object));
}

/** What it is and its label, as lists and the diary say it: Ruta «Senda norte». */
export function objectName(
  object: MapObject,
  objects: GroupState['objects'],
  t: Translate,
): string {
  if (object.type === 'sweep') return stripName(object, objects, t);
  const kind = t(objectKind(object));
  const label = shownText(object.label);
  return label ? `${kind} «${label}»` : kind;
}

function stripName(sweep: SweepEvent, objects: GroupState['objects'], t: Translate): string {
  const place = { strip: sweep.strip + 1, strips: sweep.strips };
  const area = objects.get(eventRefKey(sweep.area));
  if (area === undefined || area.type === 'object-delete' || area.type === 'sweep') {
    return t('stripNameAlone', place);
  }
  return t('stripName', { ...place, area: shownText(area.label) || t(objectKind(area)) });
}
