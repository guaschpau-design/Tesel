// What a coordinator is told without going to look: someone joins the group, another member sends
// a situation report, starts or finishes a task, enters a danger area or leaves the area of their
// task (protocol §3.18). Only what happened lately is news: what a
// device catches up on after a while away is in the diary, not in a burst of notices.

import type { GroupState } from '@tesel/core';
import {
  eventRefKey,
  type NodeId,
  type ReportEvent,
  type TaskEvent,
  type ZoneCrossingEvent,
} from '@tesel/protocol';

/** Older than this, in seconds, an event is caught up on, not news. */
export const RECENT_S = 5 * 60;

export type GroupNews =
  | { readonly kind: 'joined'; readonly who: NodeId }
  | { readonly kind: 'report'; readonly report: ReportEvent }
  | { readonly kind: 'task'; readonly task: TaskEvent }
  | { readonly kind: 'crossing'; readonly crossing: ZoneCrossingEvent };

/** The parts of the group's state that make news. */
export type NewsState = Pick<GroupState, 'members' | 'reports' | 'tasks' | 'zoneCrossings'>;

/**
 * What is new in `after` since `before`, by others than `self` and no older than `RECENT_S` at
 * `now` (seconds since the epoch): members who joined, reports, tasks started or finished, danger
 * areas entered and areas of tasks left.
 */
export function groupNews(
  before: NewsState,
  after: NewsState,
  self: NodeId,
  now: number,
): GroupNews[] {
  const fresh = (event: { readonly origin: NodeId; readonly time: number }) =>
    event.origin !== self && now - event.time <= RECENT_S;
  const joined = [...after.members.values()]
    .filter((info) => !before.members.has(info.origin) && fresh(info))
    .map((info): GroupNews => ({ kind: 'joined', who: info.origin }));
  const reported = new Set(before.reports.map(eventRefKey));
  const reports = after.reports
    .filter((report) => !reported.has(eventRefKey(report)) && fresh(report))
    .map((report): GroupNews => ({ kind: 'report', report }));
  const tasks = [...after.tasks]
    .filter(([key, task]) => {
      const moved = task.status === 'in-progress' || task.status === 'done';
      return moved && before.tasks.get(key)?.status !== task.status && fresh(task);
    })
    .map(([, task]): GroupNews => ({ kind: 'task', task }));
  const crossed = new Set(before.zoneCrossings.map(eventRefKey));
  const crossings = after.zoneCrossings
    .filter(
      (crossing) =>
        !crossed.has(eventRefKey(crossing)) &&
        fresh(crossing) &&
        ((crossing.kind === 'danger' && crossing.crossing === 'entered') ||
          (crossing.kind === 'assigned' && crossing.crossing === 'left')),
    )
    .map((crossing): GroupNews => ({ kind: 'crossing', crossing }));
  return [...joined, ...reports, ...tasks, ...crossings];
}
