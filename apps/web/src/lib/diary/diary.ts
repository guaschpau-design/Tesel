// The diary of an operation: what happened in the group, line by line, in the order every device
// agrees on, written out in the user's language from the journal (core/state/journal.ts).

import type { GroupState, JournalEvent } from '@tesel/core';
import {
  eventRefKey,
  sosPlace,
  type LatLon,
  type DutyStatus,
  type MarkerEvent,
  type NodeId,
  type ShapeEvent,
  type SweepEvent,
  type TaskEvent,
  type TaskStatus,
} from '@tesel/protocol';

import type { MessageKey, Translate } from '../i18n/index.ts';
import { ROLE_LABELS } from '../groups/role-label.ts';
import { aliasOf, nameOf } from '../members/alias.ts';
import { DUTY_STATUSES } from '../members/member-catalog.ts';
import { SOS_KINDS } from '../incidents/sos-kinds.ts';
import { objectAnchor } from '../objects/object-anchor.ts';
import { objectName } from '../objects/object-names.ts';
import { reportLine } from '../reports/report-summary.ts';
import { placePoint } from '../tasks/tasks.ts';
import { shownText } from '../text.ts';

export interface DiaryLine {
  /** The event's reference key. */
  readonly key: string;
  /** Seconds since the epoch, as the author's device recorded it. */
  readonly time: number;
  readonly author: string;
  readonly text: string;
  /** Where it happened, when it happened somewhere: an object, an SOS, a task's place. */
  readonly at: LatLon | null;
}

/** Every line of the diary, oldest first. */
export function diaryLines(state: GroupState, t: Translate): DiaryLine[] {
  const introduced = new Set<string>();
  /** Each object as it was at the line being written. */
  const objects = new Map<string, MarkerEvent | ShapeEvent | SweepEvent>();
  const tasks = new Map<string, TaskEvent>();
  /** The teams told of so far, by ID. */
  const teams = new Set<NodeId>();
  /** Each member's status, as last told. */
  const statuses = new Map<NodeId, DutyStatus>();
  return state.journal.flatMap((event) => {
    const text = describe(event);
    if (text === null) return [];
    return [
      {
        key: eventRefKey(event),
        time: event.time,
        author: aliasOf(state, event.origin),
        // Written from what members wrote: shown without the characters no one sees (ADR-0110).
        text: shownText(text),
        at: placeOf(event, objects),
      },
    ];
  });

  function describe(event: JournalEvent): string | null {
    switch (event.type) {
      case 'member-info': {
        const role = t(ROLE_LABELS[event.role]);
        if (introduced.has(event.origin))
          return t('diaryMemberChanged', { name: event.alias, role });
        introduced.add(event.origin);
        return t('diaryJoined', { role });
      }
      case 'position-hidden':
        return t('diaryStoppedSharing');
      case 'chat':
        return t('diaryChat', { text: event.text });
      case 'sos':
        return withText(t('diarySos', { kind: t(SOS_KINDS[event.kind].label) }), event.text);
      case 'sos-cancel': {
        const sos = state.sos.get(eventRefKey(event.sos))?.[0];
        return sos ? t('diarySosCancelled', { name: aliasOf(state, sos.origin) }) : null;
      }
      case 'ack': {
        // What was received, once it has arrived here too; until then the line waits.
        const target = eventRefKey(event.target);
        const sos = state.sos.get(target)?.[0];
        return sos ? t('diaryAckSos', { name: aliasOf(state, sos.origin) }) : null;
      }
      // The app neither sends nor shows alerts and roll calls (ADR-0070).
      case 'alert':
      case 'roll-call':
        return null;
      case 'marker':
      case 'shape':
      case 'sweep': {
        const key = eventRefKey(event.object);
        const known = objects.has(key);
        objects.set(key, event);
        return t(known ? 'diaryChanged' : 'diaryCreated', {
          object: objectName(event, objects, t),
        });
      }
      case 'object-delete': {
        const last = objects.get(eventRefKey(event.object));
        return last ? t('diaryDeleted', { object: objectName(last, objects, t) }) : null;
      }
      case 'member-state': {
        // Only a change of status is news; battery and equipment come and go.
        const before = statuses.get(event.origin) ?? 'active';
        statuses.set(event.origin, event.status);
        return before === event.status
          ? null
          : t('diaryStatus', { status: t(DUTY_STATUSES[event.status].label) });
      }
      case 'check-in-timer':
        return event.minutes > 0
          ? t('diaryCheckInOn', { minutes: event.minutes })
          : t('diaryCheckInOff');
      case 'report':
        return t('diaryReport', { text: reportLine(event, t) });
      case 'team': {
        const known = teams.has(event.team);
        teams.add(event.team);
        const vars = { name: event.name };
        if (event.dissolved) return t('diaryTeamDissolved', vars);
        return t(known ? 'diaryTeamChanged' : 'diaryTeamCreated', vars);
      }
      case 'task': {
        const key = eventRefKey(event.task);
        const before = tasks.get(key);
        tasks.set(key, event);
        return describeTask(before, event);
      }
    }
  }

  /** The most telling change of a task: its status, then who should do it, then the rest. */
  function describeTask(before: TaskEvent | undefined, task: TaskEvent): string {
    const vars = {
      text: task.text,
      name: task.assignee === null ? t('anyone') : nameOf(state, task.assignee),
    };
    if (before === undefined) {
      return t(task.assignee === null ? 'diaryTaskCreated' : 'diaryTaskCreatedFor', vars);
    }
    if (before.status !== task.status) return t(TASK_STATUS_LINES[task.status], vars);
    if (before.assignee !== task.assignee) return t('diaryTaskAssigned', vars);
    return t('diaryTaskChanged', vars);
  }
}

const TASK_STATUS_LINES = {
  open: 'diaryTaskReopened',
  'in-progress': 'diaryTaskStarted',
  done: 'diaryTaskDone',
  cancelled: 'diaryTaskCancelled',
} as const satisfies Readonly<Record<TaskStatus, MessageKey>>;

function withText(sentence: string, text: string): string {
  return text ? `${sentence} «${text}»` : sentence;
}

/** Where an event happened; a task at an object, where the object was then. */
function placeOf(
  event: JournalEvent,
  objects: ReadonlyMap<string, MarkerEvent | ShapeEvent | SweepEvent>,
): LatLon | null {
  if (event.type === 'marker' || event.type === 'shape' || event.type === 'sweep') {
    return objectAnchor(event, objects);
  }
  if (event.type === 'sos') return sosPlace(event);
  if (event.type === 'task' || event.type === 'report') return placePoint(event.place, objects);
  return null;
}
