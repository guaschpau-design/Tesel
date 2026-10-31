// What a planned action becomes on the wire: an event of the member who acts, still without its
// header, which the sending device fills in with its own origin, sequence number and time. The
// simulator and the app's practice both send a scenario's actions through a ScenarioPerformer.

import {
  generateTeamId,
  type EventHeader,
  type EventRef,
  type Identity,
  type NodeId,
  type Place,
  type TaskEvent,
  type TeselEvent,
} from '@tesel/protocol';

import type { PlannedAction, PlannedEvent, ScenarioPlace } from './scenario.ts';

/** An event without its header. */
export type EventDraft = (header: EventHeader) => TeselEvent;

/** The member who acts, as the events they send name them. */
export interface Actor {
  readonly alias: string;
  readonly publicKey: Identity['publicKey'];
}

/**
 * Who is who on the group: the node ID of a member by their alias. Undefined for a name the runner
 * does not know, which makes the step that uses it an error in the scenario.
 */
export type Cast = (name: string) => NodeId | undefined;

/** Accuracy the simulated members report with every position, SOS and report, in metres. */
const ACCURACY_M = 6;

/** What the performer remembers of what has been sent, by the `id` the scenario gives it. */
interface Named {
  readonly refs: ReadonlyMap<string, EventRef>;
  readonly teams: ReadonlyMap<string, NodeId>;
  readonly tasks: ReadonlyMap<string, TaskEvent>;
}

/** The event of a planned action; an action that refers to anything not sent yet is an error. */
function eventDraft(action: PlannedAction, actor: Actor, named: Named, cast: Cast): EventDraft {
  const ref = (id: string): EventRef => {
    const found = named.refs.get(id);
    if (found === undefined) throw new Error(`${action.type} refers to ${id}, not sent yet`);
    return found;
  };
  const node = (name: string): NodeId => {
    const found = named.teams.get(name) ?? cast(name);
    if (found === undefined) throw new Error(`${action.type} names ${name}, who is not here`);
    return found;
  };
  const place = (where: ScenarioPlace | null): Place | null =>
    where === null
      ? null
      : where.kind === 'point'
        ? where
        : { kind: 'object', object: ref(where.id) };
  switch (action.type) {
    case 'announce':
      return (header) => ({
        ...header,
        type: 'member-info',
        role: action.role,
        publicKey: actor.publicKey,
        alias: actor.alias,
      });
    case 'position':
      return (header) => ({
        ...header,
        type: 'position',
        ...action.where,
        accuracy: ACCURACY_M,
        heading: null,
        speed: null,
      });
    case 'chat':
      return (header) => ({ ...header, type: 'chat', text: action.text });
    case 'marker': {
      const object = named.refs.get(action.id);
      return (header) => ({
        ...header,
        type: 'marker',
        object: object ?? { origin: header.origin, seq: header.seq },
        symbol: action.symbol,
        label: action.label,
        ...action.where,
      });
    }
    case 'shape': {
      const object = named.refs.get(action.id);
      return (header) => ({
        ...header,
        type: 'shape',
        object: object ?? { origin: header.origin, seq: header.seq },
        style: action.style,
        label: action.label,
        geometry: action.geometry,
      });
    }
    case 'sos':
      return (header) => ({
        ...header,
        type: 'sos',
        kind: action.kind,
        ...action.where,
        accuracy: ACCURACY_M,
        text: action.text,
      });
    case 'ack': {
      const target = ref(action.of);
      return (header) => ({ ...header, type: 'ack', target });
    }
    case 'cancel-sos': {
      const sos = ref(action.of);
      return (header) => ({ ...header, type: 'sos-cancel', sos });
    }
    case 'state':
      return (header) => ({
        ...header,
        type: 'member-state',
        profile: action.profile,
        status: action.status,
        battery: action.battery,
        equipment: action.equipment,
      });
    case 'team': {
      const team = node(action.id);
      const members = action.members.map(node);
      return (header) => ({
        ...header,
        type: 'team',
        team,
        colour: action.colour,
        dissolved: false,
        members,
        name: action.name,
      });
    }
    case 'task': {
      const assignee = action.assignee === null ? null : node(action.assignee);
      const where = place(action.place);
      return (header) => ({
        ...header,
        type: 'task',
        task: { origin: header.origin, seq: header.seq },
        status: 'open',
        assignee,
        place: where,
        text: action.text,
      });
    }
    case 'task-status': {
      const task = named.tasks.get(action.of);
      if (task === undefined) throw new Error(`task-status refers to ${action.of}, not sent yet`);
      return (header) => ({ ...task, ...header, status: action.status });
    }
    case 'report':
      return (header) => ({
        ...header,
        type: 'report',
        place: { kind: 'point', at: action.where },
        incident: action.incident,
        hazards: action.hazards,
        access: action.access,
        casualties: action.casualties,
        resources: action.resources,
        note: action.note,
      });
    case 'sweep': {
      const area = ref(action.area);
      return (header) => ({
        ...header,
        type: 'sweep',
        object: { origin: header.origin, seq: header.seq },
        area,
        spacing: action.spacing,
        heading: action.heading,
        strip: action.strip,
        strips: action.strips,
      });
    }
  }
}

/**
 * Performs a scenario's planned events in order, each sent by its member's device. What the
 * scenario names is remembered as it is sent, for the actions that refer to it: the references
 * of objects and SOS calls, the IDs of teams and the latest of each task. A marker or a shape
 * with an `id` already sent changes that object: water that spreads, a fire that grows.
 */
export class ScenarioPerformer {
  readonly #cast: Cast;
  readonly #refs = new Map<string, EventRef>();
  readonly #teams = new Map<string, NodeId>();
  readonly #tasks = new Map<string, TaskEvent>();

  constructor(cast: Cast) {
    this.#cast = cast;
  }

  /** Sends one planned event through `send`, which returns the reference of the event it sent. */
  async perform(
    { action }: PlannedEvent,
    actor: Actor,
    send: (draft: EventDraft) => Promise<EventRef>,
  ): Promise<void> {
    const named = { refs: this.#refs, teams: this.#teams, tasks: this.#tasks };
    // A new team's ID is chosen before its event is drafted, which names it.
    if (action.type === 'team' && !this.#teams.has(action.id)) {
      const teams = new Set(this.#teams.values());
      const taken = (id: NodeId) => teams.has(id) || this.#cast(id) !== undefined;
      this.#teams.set(action.id, generateTeamId(taken));
    }
    const draft = eventDraft(action, actor, named, this.#cast);
    const ref = await send(draft);
    // A marker or a shape sent again under its `id` is a new version of the same object.
    if ('id' in action && !this.#refs.has(action.id)) this.#refs.set(action.id, ref);
    // A task as it now stands, for its next change: a change carries the whole task again.
    const id =
      action.type === 'task' ? action.id : action.type === 'task-status' ? action.of : null;
    if (id !== null) {
      const task = draft({ ...ref, time: 0 });
      if (task.type === 'task') this.#tasks.set(id, task);
    }
  }
}
