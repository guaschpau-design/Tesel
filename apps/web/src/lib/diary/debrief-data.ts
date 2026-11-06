// What the debrief of an operation tells (ADR-0118), gathered from the group's state for the
// period chosen: its figures, who took part and how far they went, each call for help with who
// received it and how soon, the tasks and where they stood at the end, the field reports, what
// to draw on its map and how busy each stretch of time was.

import { distanceMeters, teamOf, type GroupState } from '@tesel/core';
import {
  eventRefKey,
  type DutyStatus,
  type LatLon,
  type NodeId,
  type ReportEvent,
  type ShapeGeometry,
  type SosKind,
  type TaskEvent,
  type TaskStatus,
} from '@tesel/protocol';

import { aliasOf, nameOf } from '../members/alias.ts';
import { placePoint } from '../tasks/tasks.ts';
import type { DiaryLine } from './diary.ts';
import { linesIn, type Period } from './debrief.ts';

interface DebriefPerson {
  readonly name: string;
  readonly team: string | null;
  readonly coordinator: boolean;
  /** Metres along their trail in the period. */
  readonly distance: number;
  /** Their status at the end of the period, if they ever told one. */
  readonly status: DutyStatus | null;
  /** Their trail in the period, oldest first. */
  readonly track: readonly LatLon[];
}

interface DebriefCall {
  readonly name: string;
  readonly kind: SosKind;
  /** Milliseconds. */
  readonly time: number;
  readonly at: LatLon;
  readonly text: string;
  /** Who received it and how many seconds after it was sent, soonest first. */
  readonly received: readonly { readonly name: string; readonly after: number }[];
  readonly cancelled: { readonly name: string; readonly time: number } | null;
}

interface DebriefTask {
  readonly text: string;
  /** Whom it was for, or null for anyone. */
  readonly assignee: string | null;
  readonly status: TaskStatus;
  /** When it was added and when it was done, in milliseconds. */
  readonly added: number;
  readonly done: number | null;
}

interface DebriefReport {
  readonly time: number;
  readonly name: string;
  readonly event: ReportEvent;
}

interface DebriefPlace {
  readonly label: string;
  readonly at: LatLon;
}

interface DebriefZone {
  readonly label: string;
  readonly geometry: ShapeGeometry;
}

export interface Debrief {
  readonly period: Period;
  readonly lines: readonly DiaryLine[];
  readonly people: readonly DebriefPerson[];
  readonly calls: readonly DebriefCall[];
  readonly tasks: readonly DebriefTask[];
  readonly reports: readonly DebriefReport[];
  readonly messages: number;
  readonly markers: readonly DebriefPlace[];
  readonly zones: readonly DebriefZone[];
  readonly taskPlaces: readonly LatLon[];
}

export function gatherDebrief(
  state: GroupState,
  lines: readonly DiaryLine[],
  period: Period,
): Debrief {
  const inPeriod = (seconds: number) =>
    seconds * 1000 >= period.from && seconds * 1000 <= period.until;
  const untilEnd = (seconds: number) => seconds * 1000 <= period.until;
  const journal = state.journal.filter((event) => inPeriod(event.time));

  const statuses = new Map<NodeId, DutyStatus>();
  const tasks = new Map<string, TaskEvent[]>();
  for (const event of state.journal) {
    if (!untilEnd(event.time)) continue;
    if (event.type === 'member-state') statuses.set(event.origin, event.status);
    if (event.type === 'task') {
      const key = eventRefKey(event.task);
      tasks.set(key, [...(tasks.get(key) ?? []), event]);
    }
  }

  const ids = new Set<NodeId>(journal.map((event) => event.origin));
  const tracks = new Map<NodeId, LatLon[]>();
  for (const [id, trail] of state.trails) {
    const points = trail.points.filter((point) => inPeriod(point.time));
    if (points.length === 0) continue;
    ids.add(id);
    tracks.set(
      id,
      points.map(({ lat, lon }) => ({ lat, lon })),
    );
  }

  const people = [...ids]
    .map((id): DebriefPerson => {
      const track = tracks.get(id) ?? [];
      return {
        name: aliasOf(state, id),
        team: teamOf(state.teams, id)?.name ?? null,
        coordinator: state.members.get(id)?.role === 'coordinator',
        distance: pathLength(track),
        status: statuses.get(id) ?? null,
        track,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const calls = journal.flatMap((event): DebriefCall[] => {
    if (event.type !== 'sos') return [];
    const key = eventRefKey(event);
    const received = [...(state.acks.get(key)?.values() ?? [])]
      .filter((ack) => untilEnd(ack.time))
      .map((ack) => ({
        name: aliasOf(state, ack.origin),
        after: Math.max(0, ack.time - event.time),
      }))
      .sort((a, b) => a.after - b.after);
    const cancel = state.sosCancels.get(key);
    return [
      {
        name: aliasOf(state, event.origin),
        kind: event.kind,
        time: event.time * 1000,
        at: { lat: event.lat, lon: event.lon },
        text: event.text,
        received,
        cancelled:
          cancel && untilEnd(cancel.time)
            ? { name: aliasOf(state, cancel.origin), time: cancel.time * 1000 }
            : null,
      },
    ];
  });

  const debriefTasks = [...tasks.values()]
    .filter((history) => history.some((event) => inPeriod(event.time)))
    .flatMap((history): DebriefTask[] => {
      const first = history.at(0);
      const last = history.at(-1);
      if (first === undefined || last === undefined) return [];
      // Done since the last time it changed status to done.
      const doneAt = history.findLast((event) => event.status === 'done');
      return [
        {
          text: last.text,
          assignee: last.assignee === null ? null : nameOf(state, last.assignee),
          status: last.status,
          added: first.time * 1000,
          done: last.status === 'done' && doneAt ? doneAt.time * 1000 : null,
        },
      ];
    })
    .sort((a, b) => a.added - b.added);

  const markers: DebriefPlace[] = [];
  const zones: DebriefZone[] = [];
  for (const record of state.objects.values()) {
    if (!untilEnd(record.time)) continue;
    if (record.type === 'marker') {
      markers.push({ label: record.label, at: { lat: record.lat, lon: record.lon } });
    }
    if (record.type === 'shape') zones.push({ label: record.label, geometry: record.geometry });
  }

  return {
    period,
    lines: linesIn(lines, period),
    people,
    calls,
    tasks: debriefTasks,
    reports: journal.flatMap((event) =>
      event.type === 'report'
        ? [{ time: event.time * 1000, name: aliasOf(state, event.origin), event }]
        : [],
    ),
    messages: journal.filter((event) => event.type === 'chat').length,
    markers,
    zones,
    taskPlaces: debriefTasks.length === 0 ? [] : taskPlacesOf(state, tasks, inPeriod),
  };
}

function taskPlacesOf(
  state: GroupState,
  tasks: ReadonlyMap<string, readonly TaskEvent[]>,
  inPeriod: (seconds: number) => boolean,
): LatLon[] {
  return [...tasks.values()].flatMap((history) => {
    if (!history.some((event) => inPeriod(event.time))) return [];
    const place = placePoint(history.at(-1)?.place ?? null, state.objects);
    return place ? [place] : [];
  });
}

/** Metres along a line of points. */
function pathLength(points: readonly LatLon[]): number {
  let sum = 0;
  let previous: LatLon | undefined;
  for (const point of points) {
    if (previous) sum += distanceMeters(previous, point);
    previous = point;
  }
  return sum;
}
