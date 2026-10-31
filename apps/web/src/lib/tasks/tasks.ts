// The team's tasks as the app shows them (protocol §3.11, ADR-0025): the list, what a tap on a
// task's main button does, and which tasks were just handed to this device.

import { teamOf, type GroupState } from '@tesel/core';
import {
  eventRefKey,
  type EventRef,
  type LatLon,
  type NodeId,
  type TaskEvent,
  type Place,
  type TaskStatus,
} from '@tesel/protocol';

import { aliasOf, nameOf } from '../members/alias.ts';
import { objectAnchor } from '../objects/object-anchor.ts';
import { isFor } from '../teams/teams.ts';

/**
 * What the tasks panel edits: a new task, at a place or nowhere in particular, or an existing one;
 * with what the form held, if it was left to pick the task's place on the map.
 */
export type TaskEditing =
  /** A new task, at a point or an object of the map, or nowhere in particular. */
  (
    | { readonly kind: 'new'; readonly place: Place | null }
    /** An existing task, by its reference's key. */
    | { readonly kind: 'existing'; readonly key: string }
  ) & { readonly draft?: TaskFields };

/** What a task holds besides its reference: what the form edits and the feed sends. */
export interface TaskFields {
  readonly status: TaskStatus;
  readonly assignee: NodeId | null;
  readonly place: Place | null;
  readonly text: string;
}

export interface TaskRow {
  /** The task reference's key. */
  readonly key: string;
  readonly task: EventRef;
  readonly fields: TaskFields;
  /** For this device, or for its team. */
  readonly mine: boolean;
  /** Who should do it, a member or a team, or null for anyone. */
  readonly assigneeName: string | null;
  /** Who changed it last, and when (seconds). */
  readonly changedBy: string;
  readonly changedAt: number;
}

export interface TaskList {
  /** Open and in progress: this device's first, then those in progress, then oldest first. */
  readonly pending: readonly TaskRow[];
  /** Done, most recently finished first. Cancelled tasks are only in the diary. */
  readonly done: readonly TaskRow[];
}

export function fieldsOf(event: TaskEvent): TaskFields {
  return {
    status: event.status,
    assignee: event.assignee,
    place: event.place,
    text: event.text,
  };
}

export function isPending(status: TaskStatus): boolean {
  return status === 'open' || status === 'in-progress';
}

export function taskList(state: GroupState, self: NodeId): TaskList {
  const created = creationTimes(state);
  const rows = [...state.tasks.entries()].map(([key, event]) => rowOf(state, self, key, event));
  const pending = rows
    .filter((row) => isPending(row.fields.status))
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        Number(b.fields.status === 'in-progress') - Number(a.fields.status === 'in-progress') ||
        (created.get(a.key) ?? 0) - (created.get(b.key) ?? 0) ||
        a.key.localeCompare(b.key),
    );
  const done = rows
    .filter((row) => row.fields.status === 'done')
    .sort((a, b) => b.changedAt - a.changedAt || a.key.localeCompare(b.key));
  return { pending, done };
}

/** For whom a part of the list is: this device or its team, someone else by name, or anyone. */
export type TaskDoer =
  | { readonly kind: 'you' }
  | { readonly kind: 'named'; readonly name: string }
  | { readonly kind: 'anyone' };

/**
 * The rows by whom they are for, each part in the list's order: this device's first, then each
 * other member or team by name, then those for anyone; so whoever coordinates sees who has what.
 */
export function byDoer(
  rows: readonly TaskRow[],
): { readonly doer: TaskDoer; readonly rows: TaskRow[] }[] {
  const parts = new Map<string, { readonly doer: TaskDoer; readonly rows: TaskRow[] }>();
  for (const row of rows) {
    const doer = doerOf(row);
    const key = doer.kind === 'named' ? `named:${doer.name}` : doer.kind;
    const part = parts.get(key) ?? { doer, rows: [] };
    part.rows.push(row);
    parts.set(key, part);
  }
  const rank = (doer: TaskDoer) => ['you', 'named', 'anyone'].indexOf(doer.kind);
  return [...parts.values()].sort(
    (a, b) =>
      rank(a.doer) - rank(b.doer) ||
      (a.doer.kind === 'named' && b.doer.kind === 'named'
        ? a.doer.name.localeCompare(b.doer.name)
        : 0),
  );
}

export function doerOf(row: TaskRow): TaskDoer {
  if (row.mine) return { kind: 'you' };
  return row.assigneeName === null ? { kind: 'anyone' } : { kind: 'named', name: row.assigneeName };
}

/** Whether this device moves a task along from the list: its own, or one for anyone. */
export function canMove(row: TaskRow): boolean {
  return row.mine || row.fields.assignee === null;
}

/** A member's tasks still to do, theirs and their team's, in the order of the list. */
export function pendingFor(state: GroupState, member: NodeId, self: NodeId): TaskRow[] {
  const team = teamOf(state.teams, member)?.team;
  return taskList(state, self).pending.filter(
    (row) => row.fields.assignee === member || (team !== undefined && row.fields.assignee === team),
  );
}

/** Tasks for this device or its team still to do: the number on the dock. */
export function myPendingCount(state: GroupState, self: NodeId): number {
  let count = 0;
  for (const task of state.tasks.values()) {
    if (isFor(task.assignee, self, state.teams) && isPending(task.status)) count++;
  }
  return count;
}

/**
 * The task after its main button: start it (taking it if it was for anyone), finish it, or open it
 * again.
 */
export function advance(fields: TaskFields, self: NodeId): TaskFields {
  switch (fields.status) {
    case 'open':
      return { ...fields, status: 'in-progress', assignee: fields.assignee ?? self };
    case 'in-progress':
      return { ...fields, status: 'done' };
    case 'done':
    case 'cancelled':
      return { ...fields, status: 'open' };
  }
}

/** Where a task's place is on the map now: none if it has none, or its object is gone. */
export function placePoint(place: Place | null, objects: GroupState['objects']): LatLon | null {
  if (place === null) return null;
  if (place.kind === 'point') return place.at;
  const object = objects.get(eventRefKey(place.object));
  return object === undefined || object.type === 'object-delete'
    ? null
    : objectAnchor(object, objects);
}

/** A task of this device still to do along a route, given the route's key. */
export function routeTaskOf(
  state: Pick<GroupState, 'tasks' | 'teams'>,
  routeKey: string,
  self: NodeId,
): TaskEvent | null {
  for (const task of state.tasks.values()) {
    const { place } = task;
    const mine = isFor(task.assignee, self, state.teams);
    if (!mine || !isPending(task.status) || place?.kind !== 'object') continue;
    if (eventRefKey(place.object) === routeKey) return task;
  }
  return null;
}

/** Pending tasks of this device or its team, by key: compared before and after to notice new ones. */
export function assignedTo(
  state: Pick<GroupState, 'tasks' | 'teams'>,
  self: NodeId,
): ReadonlyMap<string, TaskEvent> {
  const mine = new Map<string, TaskEvent>();
  for (const [key, task] of state.tasks) {
    if (isFor(task.assignee, self, state.teams) && isPending(task.status)) mine.set(key, task);
  }
  return mine;
}

/** Tasks someone else has just handed to this device: pending for it now and not before. */
export function newlyAssigned(
  before: ReadonlyMap<string, TaskEvent>,
  after: ReadonlyMap<string, TaskEvent>,
  self: NodeId,
): TaskEvent[] {
  return [...after.entries()]
    .filter(([key, task]) => !before.has(key) && task.origin !== self)
    .map(([, task]) => task);
}

function rowOf(state: GroupState, self: NodeId, key: string, event: TaskEvent): TaskRow {
  return {
    key,
    task: event.task,
    fields: fieldsOf(event),
    mine: isFor(event.assignee, self, state.teams),
    assigneeName: event.assignee === null ? null : nameOf(state, event.assignee),
    changedBy: aliasOf(state, event.origin),
    changedAt: event.time,
  };
}

/** When each task was created: its first event in the journal, which is in time order. */
function creationTimes(state: GroupState): Map<string, number> {
  const times = new Map<string, number>();
  for (const event of state.journal) {
    if (event.type !== 'task') continue;
    const key = eventRefKey(event.task);
    if (!times.has(key)) times.set(key, event.time);
  }
  return times;
}
