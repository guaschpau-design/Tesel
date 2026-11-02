// A staged operation as data, and the plan of events it produces. Planning is pure: the same
// scenario always gives the same plan, which a runner then sends: the simulator, over the relay.

import { distanceMeters, pathMeters } from '@tesel/core';
import type {
  Casualties,
  DutyStatus,
  Equipment,
  Hazard,
  IncidentType,
  LatLon,
  Profile,
  Resource,
  Role,
  SceneAccess,
  ShapeGeometry,
  SosKind,
  TaskStatus,
  TeamColour,
} from '@tesel/protocol';

export interface ScenarioMember {
  readonly alias: string;
  /** Members are members unless they coordinate. */
  readonly role?: Role;
  /**
   * Where the member is: one point to stay put, several to walk them in order and back, as on a
   * search sector. Absent for a member who never shares a position.
   */
  readonly route?: readonly LatLon[];
  /** Metres per second along the route; walking pace by default. */
  readonly speed?: number;
  /** True for a member who does not share their position: the route only places their SOS. */
  readonly hidden?: boolean;
}

/** Where a task is: a point, or one of the scenario's objects by its `id`. */
export type ScenarioPlace =
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'object'; readonly id: string };

/**
 * What a member does at a moment of the scenario. What later steps refer to (objects, SOS calls,
 * teams, tasks) is named by `id`; members by their alias.
 */
export type ScenarioAction =
  | { readonly type: 'chat'; readonly text: string }
  | {
      readonly type: 'marker';
      readonly id: string;
      readonly symbol: number;
      readonly label: string;
      readonly where: LatLon;
    }
  | {
      readonly type: 'shape';
      readonly id: string;
      readonly style: number;
      readonly label: string;
      readonly geometry: ShapeGeometry;
    }
  /** An SOS from where the member is at that moment. */
  | { readonly type: 'sos'; readonly id: string; readonly kind: SosKind; readonly text: string }
  | { readonly type: 'ack'; readonly of: string }
  | { readonly type: 'cancel-sos'; readonly of: string }
  /** What the member tells about themselves (protocol §3.14). */
  | {
      readonly type: 'state';
      readonly profile: Profile;
      readonly status: DutyStatus;
      readonly battery: number | null;
      readonly equipment: readonly Equipment[];
    }
  /** A team, or a new version of it: `members` are aliases. */
  | {
      readonly type: 'team';
      readonly id: string;
      readonly name: string;
      readonly colour: TeamColour;
      readonly members: readonly string[];
    }
  /** A new task, open, for a member (by alias), a team (by `id`) or anyone (null). */
  | {
      readonly type: 'task';
      readonly id: string;
      readonly text: string;
      readonly assignee: string | null;
      readonly place: ScenarioPlace | null;
    }
  /** A task taken, finished or cancelled: the rest of it stays as it was. */
  | { readonly type: 'task-status'; readonly of: string; readonly status: TaskStatus }
  /** A situation report from where the member is at that moment (protocol §3.16). */
  | {
      readonly type: 'report';
      readonly incident: IncidentType;
      readonly hazards: readonly Hazard[];
      readonly access: SceneAccess;
      readonly casualties: Casualties;
      readonly resources: readonly Resource[];
      readonly note: string;
    }
  /** One strip of the sweep of an area, which the scenario names by its `id` (protocol §3.13). */
  | {
      readonly type: 'sweep';
      readonly id: string;
      readonly area: string;
      readonly spacing: number;
      readonly heading: number;
      readonly strip: number;
      readonly strips: number;
    };

export interface ScenarioStep {
  /** Seconds from the start of the scenario. */
  readonly at: number;
  /** Alias of the member who acts. */
  readonly by: string;
  readonly action: ScenarioAction;
}

export interface Scenario {
  readonly name: string;
  readonly description: string;
  /** Where the map should look to see it. */
  readonly center: LatLon;
  /** Seconds the scenario lasts; members keep walking until then. */
  readonly duration: number;
  readonly members: readonly ScenarioMember[];
  readonly steps: readonly ScenarioStep[];
}

/** Actions sent from where their member is at that moment. */
type PlacedAction = Extract<ScenarioAction, { readonly type: 'sos' | 'report' }>;

/**
 * One thing to send: a member's announcement, a position or a step of the scenario, with an SOS
 * or a report placed where its sender is at that moment.
 */
export type PlannedAction =
  | { readonly type: 'announce'; readonly role: Role }
  | { readonly type: 'position'; readonly where: LatLon }
  | Exclude<ScenarioAction, PlacedAction>
  | (PlacedAction & { readonly where: LatLon });

export interface PlannedEvent {
  readonly at: number;
  readonly by: string;
  readonly action: PlannedAction;
}

export interface PlanOptions {
  /** Seconds between position reports of each member. */
  readonly positionEvery: number;
}

/** Walking pace, in metres per second. */
const WALKING_SPEED = 1.2;

/**
 * Every event of the scenario in time order. Members announce themselves first, positions follow
 * their routes, and SOS calls and reports take the position of their sender at that moment.
 */
export function plan(scenario: Scenario, options: PlanOptions): PlannedEvent[] {
  const members = new Map(scenario.members.map((member) => [member.alias, member]));
  const steps = scenario.steps.map((step): PlannedEvent => {
    const member = members.get(step.by);
    if (member === undefined) throw new Error(`step at ${String(step.at)}s: no member ${step.by}`);
    const { action } = step;
    return action.type === 'sos' || action.type === 'report'
      ? { ...step, action: { ...action, where: whereAt(member, step.at) } }
      : { ...step, action };
  });
  const planned: PlannedEvent[] = scenario.members.map((member) => ({
    at: 0,
    by: member.alias,
    action: { type: 'announce', role: member.role ?? 'member' },
  }));
  for (const member of scenario.members) {
    if (member.route === undefined || member.hidden === true) continue;
    for (let at = 0; at <= scenario.duration; at += options.positionEvery) {
      planned.push({
        at,
        by: member.alias,
        action: { type: 'position', where: whereAt(member, at) },
      });
    }
  }
  planned.push(...steps);
  // A stable sort keeps announcements before positions, and positions before steps, at a tie.
  return planned.sort((a, b) => a.at - b.at);
}

/** Where a member is after `seconds`: walking their route back and forth, or standing still. */
export function whereAt(member: ScenarioMember, seconds: number): LatLon {
  const route = member.route ?? [];
  if (route[0] === undefined) throw new Error(`${member.alias} has no route`);
  const total = pathMeters(route);
  if (total === 0) return route[0];
  // Out and back: the walk repeats every two lengths of the route.
  const travelled = (seconds * (member.speed ?? WALKING_SPEED)) % (2 * total);
  return pointAlong(route, travelled <= total ? travelled : 2 * total - travelled);
}

/** The point `meters` along a route from its start; its end, past it. */
function pointAlong(route: readonly LatLon[], meters: number): LatLon {
  const first = route[0];
  if (first === undefined) throw new Error('a route with no points');
  let left = meters;
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1] ?? first;
    const to = route[index] ?? from;
    const length = distanceMeters(from, to);
    if (left <= length) {
      const fraction = length === 0 ? 0 : left / length;
      return {
        lat: from.lat + (to.lat - from.lat) * fraction,
        lon: from.lon + (to.lon - from.lon) * fraction,
      };
    }
    left -= length;
  }
  return route.at(-1) ?? first;
}
