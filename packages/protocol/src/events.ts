// Events as TypeScript values (docs/protocol.md §3). The codec converts between these and bytes.
//
// Units in this API are the natural ones — degrees, metres, metres per second — and the codec
// takes care of the integer representations on the wire.

/** §1 Node ID as 8 lowercase hex characters, e.g. "a1b2c3d4". */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** §1 Points to the event with this (origin, seq). */
export interface EventRef {
  readonly origin: NodeId;
  readonly seq: number;
}

/** §3.10 A map object is identified by the reference of the event that created it. */
export type ObjectRef = EventRef;

export interface LatLon {
  /** Degrees, -90 to 90. */
  readonly lat: number;
  /** Degrees, -180 to 180. */
  readonly lon: number;
}

/** §3.1 Fields common to every event. */
export interface EventHeader {
  readonly origin: NodeId;
  /** Per-origin sequence number, from 1. */
  readonly seq: number;
  /** Seconds since the Unix epoch. */
  readonly time: number;
}

export type Role = 'member' | 'coordinator';

export interface MemberInfoEvent extends EventHeader {
  readonly type: 'member-info';
  readonly role: Role;
  readonly publicKey: Uint8Array;
  readonly alias: string;
}

export interface PositionEvent extends EventHeader, LatLon {
  readonly type: 'position';
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
  /** Degrees clockwise from north, 0-359, or null if unknown. */
  readonly heading: number | null;
  /** Metres per second, or null if unknown. */
  readonly speed: number | null;
}

export interface PositionHiddenEvent extends EventHeader {
  readonly type: 'position-hidden';
}

export interface ChatEvent extends EventHeader {
  readonly type: 'chat';
  readonly text: string;
}

export interface MarkerEvent extends EventHeader, LatLon {
  readonly type: 'marker';
  readonly object: ObjectRef;
  /** §4.1 symbol code. */
  readonly symbol: number;
  readonly label: string;
}

export type ShapeGeometry =
  | { readonly kind: 'polyline'; readonly points: readonly LatLon[] }
  | { readonly kind: 'polygon'; readonly points: readonly LatLon[] }
  | { readonly kind: 'circle'; readonly center: LatLon; readonly radius: number };

export interface ShapeEvent extends EventHeader {
  readonly type: 'shape';
  readonly object: ObjectRef;
  /** §4.2 style code. */
  readonly style: number;
  readonly label: string;
  readonly geometry: ShapeGeometry;
}

export interface ObjectDeleteEvent extends EventHeader {
  readonly type: 'object-delete';
  readonly object: ObjectRef;
}

export type SosKind = 'general' | 'medical' | 'trapped' | 'fire' | 'security';

export interface SosEvent extends EventHeader, LatLon {
  readonly type: 'sos';
  readonly kind: SosKind;
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
  readonly text: string;
}

export interface SosCancelEvent extends EventHeader {
  readonly type: 'sos-cancel';
  readonly sos: EventRef;
}

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface AlertEvent extends EventHeader {
  readonly type: 'alert';
  readonly level: AlertLevel;
  readonly text: string;
}

export interface AckEvent extends EventHeader {
  readonly type: 'ack';
  readonly target: EventRef;
}

export type TaskStatus = 'open' | 'in-progress' | 'done' | 'cancelled';

/** §3.11 Where a task or a report is: a point, or a map object, which it follows wherever it is. */
export type Place =
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'object'; readonly object: ObjectRef };

/** §3.11 Creates or replaces a task. */
export interface TaskEvent extends EventHeader {
  readonly type: 'task';
  /** The reference of the event that created the task. */
  readonly task: EventRef;
  readonly status: TaskStatus;
  /** Who should do it: a member, a team (§3.15), or null for anyone. */
  readonly assignee: NodeId | null;
  /** Where, or null for nowhere in particular. */
  readonly place: Place | null;
  readonly text: string;
}

/** §3.14 What a member does for a living, as far as the team needs to know. */
export type Profile =
  | 'unspecified'
  | 'police'
  | 'civil-protection'
  | 'firefighters'
  | 'medical'
  | 'rescue'
  | 'volunteer'
  | 'military'
  | 'other';

/** §3.14 Whether a member can be counted on now. */
export type DutyStatus = 'active' | 'resting' | 'off-duty';

/** §3.14 What a member carries. */
export type Equipment =
  | 'first-aid'
  | 'defibrillator'
  | 'stretcher'
  | 'food'
  | 'water'
  | 'blankets'
  | 'rope'
  | 'light'
  | 'radio'
  | 'extinguisher'
  | 'vehicle'
  | 'drone'
  | 'weapon'
  /** A LoRa radio linked to the app now: set by the app itself, never by hand. */
  | 'lora'
  | 'four-by-four'
  | 'boat'
  | 'search-dog'
  | 'thermal-camera'
  | 'satellite-phone'
  | 'generator'
  | 'power-bank'
  | 'chainsaw'
  | 'pump'
  | 'tools'
  | 'oxygen'
  | 'megaphone';

/** §3.14 A member's profile, status, battery and equipment; each newer one replaces the last. */
export interface MemberStateEvent extends EventHeader {
  readonly type: 'member-state';
  readonly profile: Profile;
  readonly status: DutyStatus;
  /** Percent, 0–100, or null if unknown. */
  readonly battery: number | null;
  /** In the order of their codes (§3.14), each once. */
  readonly equipment: readonly Equipment[];
}

/**
 * §3.17 How long a member may go without moving or touching their device before it asks whether
 * they are well; 0 turns the question off.
 */
export interface CheckInTimerEvent extends EventHeader {
  readonly type: 'check-in-timer';
  readonly minutes: number;
}

/** §3.18 Which way a member crossed the edge of a zone. */
export type ZoneCrossing = 'entered' | 'left';

/** §3.18 What the zone is to the member: a danger area, or where their task is. */
export type ZoneKind = 'other' | 'danger' | 'assigned';

/**
 * §3.18 A member's device saw them cross the edge of an area of the group: into a danger area,
 * out of the area of their task. Where they were when it was borne out, as a POSITION says.
 */
export interface ZoneCrossingEvent extends EventHeader, LatLon {
  readonly type: 'zone-crossing';
  /** The area: a SHAPE (polygon or circle). */
  readonly zone: ObjectRef;
  readonly crossing: ZoneCrossing;
  readonly kind: ZoneKind;
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
}

/** §3.16 What a situation report is about. */
export type IncidentType =
  | 'other'
  | 'fire'
  | 'flood'
  | 'traffic-accident'
  | 'collapse'
  | 'missing-person'
  | 'rescue'
  | 'hazardous-materials'
  | 'medical';

/** §3.16 Dangers on the scene. */
export type Hazard =
  | 'fire'
  | 'smoke'
  | 'gas'
  | 'electricity'
  | 'water'
  | 'collapse'
  | 'chemicals'
  | 'traffic'
  | 'violence';

/** §3.16 How the scene can be reached. */
export type SceneAccess = 'unknown' | 'clear' | 'difficult' | 'blocked';

/** §3.16 Help the scene needs. */
export type Resource =
  | 'ambulance'
  | 'firefighters'
  | 'police'
  | 'rescue'
  | 'helicopter'
  | 'machinery'
  | 'people'
  | 'supplies'
  | 'shelter';

/** §3.16 How many casualties of each triage category; null where unknown. */
export interface Casualties {
  readonly red: number | null;
  readonly yellow: number | null;
  readonly green: number | null;
  readonly black: number | null;
}

/** §3.16 A situation report, in the order of METHANE: where, what, dangers, access, casualties, help. */
export interface ReportEvent extends EventHeader {
  readonly type: 'report';
  readonly place: Place | null;
  readonly incident: IncidentType;
  /** In the order of their codes, each once. */
  readonly hazards: readonly Hazard[];
  readonly access: SceneAccess;
  readonly casualties: Casualties;
  /** In the order of their codes, each once. */
  readonly resources: readonly Resource[];
  readonly note: string;
}

/** §3.15 The colour a team is shown in. */
export type TeamColour = 'blue' | 'orange' | 'teal' | 'red' | 'green' | 'black';

/**
 * §3.15 Creates or replaces a team: its name, colour and members. A team's ID is in the space of
 * node IDs, so a task (§3.11) can be for a team as for a member.
 */
export interface TeamEvent extends EventHeader {
  readonly type: 'team';
  readonly team: NodeId;
  readonly colour: TeamColour;
  /** A dissolved team has no members and is no longer shown. */
  readonly dissolved: boolean;
  readonly members: readonly NodeId[];
  readonly name: string;
}

/**
 * §3.13 One strip of a sweep of a search area: the lanes one team walks. A map object (§3.10),
 * drawn from its area and the sweep's recipe, which every device works out alike.
 */
export interface SweepEvent extends EventHeader {
  readonly type: 'sweep';
  readonly object: ObjectRef;
  /** The polygon swept. */
  readonly area: ObjectRef;
  /** Metres between lanes, at least 1. */
  readonly spacing: number;
  /** Direction of the lanes, in degrees clockwise from true north, 0–179. */
  readonly heading: number;
  /** Which strip this is, from 0. */
  readonly strip: number;
  /** How many strips the sweep has, more than `strip`. */
  readonly strips: number;
}

/** §3.12 Asks every member to say they are well; each answers with an ACK. */
export interface RollCallEvent extends EventHeader {
  readonly type: 'roll-call';
  /** Empty for the usual question, worded by each receiver in its own language. */
  readonly text: string;
}

export type TeselEvent =
  | MemberInfoEvent
  | PositionEvent
  | PositionHiddenEvent
  | ChatEvent
  | MarkerEvent
  | ShapeEvent
  | ObjectDeleteEvent
  | SosEvent
  | SosCancelEvent
  | AlertEvent
  | AckEvent
  | TaskEvent
  | RollCallEvent
  | SweepEvent
  | MemberStateEvent
  | TeamEvent
  | ReportEvent
  | CheckInTimerEvent
  | ZoneCrossingEvent;

export type EventType = TeselEvent['type'];
