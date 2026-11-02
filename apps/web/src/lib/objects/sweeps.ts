// Sweeps as the app shows them (protocol §3.13): each strip with its area and lanes, the strips
// over an area, who walks each (a member or a team) and how much of it is swept, and its colour.

import {
  compareEvents,
  membersFor,
  stripLanes,
  sweepLanes,
  sweepPath,
  sweptFraction,
  type GroupState,
  type SweepLanes,
} from '@tesel/core';
import {
  eventRefKey,
  ShapeStyleCode,
  type LatLon,
  type NodeId,
  type PositionEvent,
  type ShapeEvent,
  type SweepEvent,
  type TaskEvent,
} from '@tesel/protocol';

import { travelled } from '../position/movement.ts';
import { TEAM_COLOURS } from '../teams/teams.ts';
import type { Tone } from '../ui/theme.ts';

/** The colours strips take by their place, those of the teams: as many strips as colours. */
const STRIP_TONES: readonly Tone[] = Object.values(TEAM_COLOURS).map((colour) => colour.tone);
export const MAX_STRIPS = STRIP_TONES.length;

/** A strip's colour by its place in the sweep. */
function stripTone(strip: number): Tone {
  return STRIP_TONES[strip % STRIP_TONES.length] ?? 'slate';
}

/** The colour of whoever a strip is for: their team's, or else the strip's own. */
export function walkerTone(teams: GroupState['teams'], walker: NodeId | null, strip: number): Tone {
  const team = walker === null ? undefined : teams.get(walker);
  return team ? TEAM_COLOURS[team.colour].tone : stripTone(strip);
}

/** A strip of a sweep, with the area it sweeps and its lanes. */
export interface Strip {
  readonly sweep: SweepEvent;
  readonly area: ShapeEvent;
  readonly lanes: SweepLanes;
}

/** Strips worked out, kept while their area stays the same. */
const worked = new WeakMap<SweepEvent, Strip>();

/** A strip with its area and lanes, while its area is a polygon on the map. */
export function stripOf(sweep: SweepEvent, objects: GroupState['objects']): Strip | null {
  const area = objects.get(eventRefKey(sweep.area));
  if (area?.type !== 'shape' || area.geometry.kind !== 'polygon') return null;
  const known = worked.get(sweep);
  if (known?.area === area) return known;
  const all = sweepLanes(area.geometry.points, sweep.spacing, sweep.heading);
  const strip = { sweep, area, lanes: stripLanes(all, sweep.strip, sweep.strips) };
  worked.set(sweep, strip);
  return strip;
}

const walked = new WeakMap<Strip, readonly LatLon[]>();

/**
 * The way a strip is walked: lane after lane, each the other way from the one before. The same
 * strip gives the same path, so that guidance along it keeps its progress while the group's state
 * changes around it.
 */
export function stripPath(strip: Strip): readonly LatLon[] {
  const known = walked.get(strip);
  if (known !== undefined) return known;
  const path = sweepPath(strip.lanes);
  walked.set(strip, path);
  return path;
}

/** The strips over an area, by key, in strip order. */
export function stripsOver(
  objects: GroupState['objects'],
  areaKey: string,
): { readonly key: string; readonly sweep: SweepEvent }[] {
  return [...objects]
    .flatMap(([key, record]) =>
      record.type === 'sweep' && eventRefKey(record.area) === areaKey
        ? [{ key, sweep: record }]
        : [],
    )
    .sort((a, b) => a.sweep.strip - b.sweep.strip);
}

/** The tasks along a strip, but cancelled ones. */
export function stripTasks(tasks: GroupState['tasks'], stripKey: string): TaskEvent[] {
  return [...tasks.values()].filter(
    (task) =>
      task.status !== 'cancelled' &&
      task.place?.kind === 'object' &&
      eventRefKey(task.place.object) === stripKey,
  );
}

/** Who walks a strip: whoever its newest task is for, a member or a team, or no one in particular. */
export function stripWalker(tasks: GroupState['tasks'], stripKey: string): NodeId | null {
  const newest = stripTasks(tasks, stripKey).sort((a, b) => b.time - a.time)[0];
  return newest?.assignee ?? null;
}

/** Whether a strip is done: some task along it is done, and none is still to do. */
export function isStripDone(tasks: GroupState['tasks'], stripKey: string): boolean {
  const along = stripTasks(tasks, stripKey);
  return (
    along.some((task) => task.status === 'done') && along.every((task) => task.status === 'done')
  );
}

/**
 * How much of a strip, from 0 to 1, the trail of a member, or those of a team's members, have
 * swept: within half the spacing of a lane, the band that lane stands for. Only where they
 * travelled counts, not where the GPS wandered (position/movement.ts).
 */
export function sweptBy(
  strip: Strip,
  state: Pick<GroupState, 'trails' | 'teams'>,
  walker: NodeId,
): number {
  const trails = membersFor(state.teams, walker).map((member) =>
    travelled(state.trails.get(member)?.points ?? NO_POINTS),
  );
  const known = swept.get(strip);
  if (known && sameTrails(known.trails, trails)) return known.fraction;
  const fraction = sweptFraction(strip.lanes, trails, strip.sweep.spacing / 2);
  swept.set(strip, { trails, fraction });
  return fraction;
}

const NO_POINTS: readonly PositionEvent[] = [];

/**
 * Each strip's last measure and the trails it was taken from: it is asked again with every
 * change of the group, and only a new position along those trails changes it.
 */
const swept = new WeakMap<
  Strip,
  { readonly trails: readonly (readonly PositionEvent[])[]; readonly fraction: number }
>();

function sameTrails(
  a: readonly (readonly PositionEvent[])[],
  b: readonly (readonly PositionEvent[])[],
): boolean {
  return a.length === b.length && a.every((trail, index) => trail === b[index]);
}

/**
 * Search areas whose sweep is over, every strip done, and still not marked cleared, that this
 * device is to mark: the one that finished the last strip, so that only one device does. Every
 * strip the sweep was planned with must be here: one deleted, or not arrived yet over the radio,
 * leaves ground unsearched.
 */
export function areasToClear(state: GroupState, self: NodeId): ShapeEvent[] {
  const byArea = new Map<string, { readonly key: string; readonly sweep: SweepEvent }[]>();
  for (const [key, record] of state.objects) {
    if (record.type !== 'sweep') continue;
    const area = eventRefKey(record.area);
    byArea.set(area, [...(byArea.get(area) ?? []), { key, sweep: record }]);
  }
  return [...byArea].flatMap(([areaKey, strips]) => {
    const area = state.objects.get(areaKey);
    if (area?.type !== 'shape' || area.style !== ShapeStyleCode.SEARCH_ASSIGNED) return [];
    if (!isWholeSweep(strips.map(({ sweep }) => sweep))) return [];
    if (!strips.every(({ key }) => isStripDone(state.tasks, key))) return [];
    const last = strips
      .flatMap(({ key }) => stripTasks(state.tasks, key))
      .reduce<TaskEvent | null>(
        (newest, task) => (newest && compareEvents(newest, task) > 0 ? newest : task),
        null,
      );
    return last?.origin === self ? [area] : [];
  });
}

/** Whether these are all the strips of one sweep: each of its strips, once. */
function isWholeSweep(strips: readonly SweepEvent[]): boolean {
  const planned = strips[0]?.strips ?? 0;
  const present = new Set(strips.map((sweep) => sweep.strip));
  return (
    planned > 0 &&
    strips.length === planned &&
    present.size === planned &&
    strips.every((sweep) => sweep.strips === planned && sweep.strip < planned)
  );
}
