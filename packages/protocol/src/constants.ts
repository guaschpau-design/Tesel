// Every numeric constant of the wire format. Section numbers refer to docs/protocol.md.

import type {
  AlertLevel,
  DutyStatus,
  Equipment,
  Hazard,
  IncidentType,
  Profile,
  Resource,
  Role,
  SceneAccess,
  SosKind,
  TaskStatus,
  TeamColour,
} from './events.ts';

/** §3.1 Protocol version carried in every event header. */
export const PROTOCOL_VERSION = 1;

/** §2 Largest MeshCore channel datagram payload: the room of one radio frame. */
export const MAX_RADIO_PAYLOAD = 165;

/** §5.2 What Tesel's seal adds to an event on the radio: the synthetic IV. */
export const RADIO_SEAL_SIZE = 12;

/** §5.2 AES block size, which is also the size of the CTR counter block. */
export const AES_BLOCK_SIZE = 16;

/** §2 The largest event an encoder writes: one that, sealed, fills a radio frame. */
export const MAX_EVENT_SIZE = MAX_RADIO_PAYLOAD - RADIO_SEAL_SIZE;

/**
 * §2 The largest event a decoder accepts. Events written before radio frames were sealed had the
 * seal's room too, the whole frame; those already kept on devices and servers still decode and
 * travel over the internet, but never go on the air again.
 */
export const MAX_DECODABLE_EVENT_SIZE = MAX_EVENT_SIZE + RADIO_SEAL_SIZE;

/** §3.1 Size of the event header. */
export const HEADER_SIZE = 14;

/** §1 Size of a node ID. */
export const NODE_ID_SIZE = 4;

/** §1 Size of an event reference: node ID plus u32 sequence number. */
export const EVENT_REF_SIZE = NODE_ID_SIZE + 4;

/** §1 Coordinates are integers in units of 10^-7 degrees. */
export const COORDINATE_SCALE = 1e7;

/** §3.7 Shape deltas are in units of 10^-5 degrees, i.e. 100 coordinate units. */
export const DELTA_UNIT = 100;

/** §3.4, §3.8 Marker for an unknown u16 measurement. */
export const UNKNOWN_U16 = 0xffff;

/** §3.2 Event type codes. Codes are never reused. */
export const EventTypeCode = {
  MEMBER_INFO: 0x01,
  POSITION: 0x02,
  POSITION_HIDDEN: 0x03,
  CHAT: 0x04,
  MARKER: 0x05,
  SHAPE: 0x06,
  OBJECT_DELETE: 0x07,
  SOS: 0x08,
  SOS_CANCEL: 0x09,
  ALERT: 0x0a,
  ACK: 0x0b,
  TASK: 0x0c,
  ROLL_CALL: 0x0d,
  SWEEP: 0x0e,
  MEMBER_STATE: 0x0f,
  TEAM: 0x10,
  REPORT: 0x11,
  CHECK_IN_TIMER: 0x12,
} as const;

/** §3.13 A sweep's lanes run in a direction below this, in degrees: the other half are the same. */
export const HALF_TURN_DEGREES = 180;

/** §3.3 Ed25519 key sizes. */
export const PUBLIC_KEY_SIZE = 32;
export const SECRET_KEY_SIZE = 32;

/** §1 A coordinate pair (lat, lon) on the wire. */
export const POINT_SIZE = 8;

/** §3.4, §3.8 Units per metre of `accuracy`: whole metres. */
export const ACCURACY_SCALE = 1;
/** §3.4 Units per metre per second of `speed`: centimetres per second. */
export const SPEED_SCALE = 100;
/** §3.4 `heading` in whole degrees, below this. */
export const FULL_TURN_DEGREES = 360;

/** Sizes of fields that limit how long the texts after them can be (§3.6, §3.8, §3.9, §3.11). */
export const SYMBOL_SIZE = 2;
export const KIND_SIZE = 1;
export const ACCURACY_SIZE = 2;

/** §3.11 TASK.place: none, a point or a map object; reserved values read as none. */
export const PlaceCode = { NONE: 0, POINT: 1, OBJECT: 2 } as const;
/** §3.11 What follows TASK.place: a point, or an object's reference, which is as long. */
export const PLACE_SIZE = 8;

/** §3.3 Alias length in bytes. */
export const ALIAS_MIN_BYTES = 1;
export const ALIAS_MAX_BYTES = 32;

/** §3.7 Shape label length in bytes. */
export const SHAPE_LABEL_MAX_BYTES = 32;

/** §3.7 Each point of a line or polygon after the first: an `i16` delta of latitude and longitude. */
const SHAPE_DELTA_SIZE = 4;

/**
 * §3.7 What a line or a polygon with the longest label holds before its points: the object, the
 * kind, the style (u16), the label with its length byte and the count of points.
 */
const SHAPE_FIXED_SIZE = EVENT_REF_SIZE + KIND_SIZE + 2 + 1 + SHAPE_LABEL_MAX_BYTES + 1;

/**
 * §3.7 Most points a line or a polygon of the app may have: as many as fit in one event with the
 * longest label (22), so that every label stays possible; with an empty label a shape holds 30.
 */
export const SHAPE_MAX_POINTS =
  1 + Math.floor((MAX_EVENT_SIZE - HEADER_SIZE - SHAPE_FIXED_SIZE - POINT_SIZE) / SHAPE_DELTA_SIZE);

/**
 * §3.13 Most lanes a sweep may have: an area wider than this many times the spacing has none, so
 * that no recipe can make a device work out lanes without end.
 */
export const SWEEP_MAX_LANES = 1000;

/** §3.7 Shape kind codes. */
export const ShapeKindCode = { POLYLINE: 1, POLYGON: 2, CIRCLE: 3 } as const;

/** §4.1 MARKER.symbol: the civil symbol set. Receivers show an unknown code as a generic point. */
export const SymbolCode = {
  GENERIC: 0x0000,
  INJURED: 0x0001,
  MISSING: 0x0002,
  FIRE: 0x0003,
  FLOOD: 0x0004,
  HAZARD: 0x0005,
  BLOCKED_ROAD: 0x0006,
  SHELTER: 0x0007,
  MEETING_POINT: 0x0008,
  MEDICAL_POST: 0x0009,
  WATER: 0x000a,
  HELICOPTER: 0x000b,
  COMMAND_POST: 0x000c,
} as const;

/** §4.2 SHAPE.style. Receivers show an unknown code as neutral. */
export const ShapeStyleCode = {
  NEUTRAL: 0x0000,
  DANGER: 0x0001,
  SEARCH_ASSIGNED: 0x0002,
  SEARCH_CLEARED: 0x0003,
  SAFE: 0x0004,
  ROUTE: 0x0005,
  OPERATION_AREA: 0x0006,
} as const;

// The codes of the enumerated fields. §3.1: a reserved code decodes to the field's default (named
// in each), so that newer senders never make older receivers drop information.

/** §3.3 MEMBER_INFO.role, and an invitation's role (§6). Default: member. */
export const RoleCode = { member: 0, coordinator: 1 } as const satisfies Record<Role, number>;

/** §3.8 SOS.kind. Default: general. */
export const SosKindCode = {
  general: 0,
  medical: 1,
  trapped: 2,
  fire: 3,
  security: 4,
} as const satisfies Record<SosKind, number>;

/** §3.9 ALERT.level. Default: warning. */
export const AlertLevelCode = {
  info: 0,
  warning: 1,
  critical: 2,
} as const satisfies Record<AlertLevel, number>;

/** §3.11 TASK.status. Default: open. */
export const TaskStatusCode = {
  open: 0,
  'in-progress': 1,
  done: 2,
  cancelled: 3,
} as const satisfies Record<TaskStatus, number>;

/** §3.14 MEMBER_STATE.profile. Default: unspecified. */
export const ProfileCode = {
  unspecified: 0,
  police: 1,
  'civil-protection': 2,
  firefighters: 3,
  medical: 4,
  rescue: 5,
  volunteer: 6,
  military: 7,
  other: 8,
} as const satisfies Record<Profile, number>;

/** §3.14 MEMBER_STATE.status. Default: active. */
export const DutyStatusCode = {
  active: 0,
  resting: 1,
  'off-duty': 2,
} as const satisfies Record<DutyStatus, number>;

/** §3.14 MEMBER_STATE.equipment: the bit of each item, from the lowest. Other bits are ignored. */
export const EquipmentBit = {
  'first-aid': 0,
  defibrillator: 1,
  stretcher: 2,
  food: 3,
  water: 4,
  blankets: 5,
  rope: 6,
  light: 7,
  radio: 8,
  extinguisher: 9,
  vehicle: 10,
  drone: 11,
  weapon: 12,
  lora: 13,
  'four-by-four': 14,
  boat: 15,
  'search-dog': 16,
  'thermal-camera': 17,
  'satellite-phone': 18,
  generator: 19,
  'power-bank': 20,
  chainsaw: 21,
  pump: 22,
  tools: 23,
  oxygen: 24,
  megaphone: 25,
} as const satisfies Record<Equipment, number>;

/** §3.16 REPORT.incident. Default: other. */
export const IncidentTypeCode = {
  other: 0,
  fire: 1,
  flood: 2,
  'traffic-accident': 3,
  collapse: 4,
  'missing-person': 5,
  rescue: 6,
  'hazardous-materials': 7,
  medical: 8,
} as const satisfies Record<IncidentType, number>;

/** §3.16 REPORT.hazards: the bit of each, from the lowest. Other bits are ignored. */
export const HazardBit = {
  fire: 0,
  smoke: 1,
  gas: 2,
  electricity: 3,
  water: 4,
  collapse: 5,
  chemicals: 6,
  traffic: 7,
  violence: 8,
} as const satisfies Record<Hazard, number>;

/** §3.16 REPORT.access. Default: unknown. */
export const SceneAccessCode = {
  unknown: 0,
  clear: 1,
  difficult: 2,
  blocked: 3,
} as const satisfies Record<SceneAccess, number>;

/** §3.16 REPORT.resources: the bit of each, from the lowest. Other bits are ignored. */
export const ResourceBit = {
  ambulance: 0,
  firefighters: 1,
  police: 2,
  rescue: 3,
  helicopter: 4,
  machinery: 5,
  people: 6,
  supplies: 7,
  shelter: 8,
} as const satisfies Record<Resource, number>;

/**
 * §3.16 What comes before a report's note: kind, place kind and its 8 bytes, incident, hazards
 * (u16), access, four counts and resources (u16).
 */
export const REPORT_FIXED_SIZE = 1 + 1 + PLACE_SIZE + 1 + 2 + 1 + 4 + 2;

/** §3.16 REPORT kind: only a situation report so far. Default: situation. */
export const REPORT_KIND_SITUATION = 0;
/** §3.16 A count of casualties that is unknown. */
export const UNKNOWN_COUNT = 0xff;

/** §3.15 TEAM.colour. Default: blue. */
export const TeamColourCode = {
  blue: 0,
  orange: 1,
  teal: 2,
  red: 3,
  green: 4,
  black: 5,
} as const satisfies Record<TeamColour, number>;

/** §3.15 Team name length in bytes. */
export const TEAM_NAME_MAX_BYTES = 32;

/** §3.15 Members a team holds at most: as many as fit in one event with the longest name. */
export const TEAM_MAX_MEMBERS = Math.floor(
  (MAX_EVENT_SIZE - HEADER_SIZE - NODE_ID_SIZE - 3 - TEAM_NAME_MAX_BYTES) / NODE_ID_SIZE,
);

/** §3.14 MEMBER_STATE.battery when unknown; values above 100 read as unknown too. */
export const UNKNOWN_BATTERY = 0xff;

/** §5 Group secret size; also the MeshCore channel key size. */
export const GROUP_SECRET_SIZE = 16;

/** §5 Derived sizes. */
export const GROUP_ID_SIZE = 16;
export const CONTENT_KEY_SIZE = 32;
export const EVENT_KEY_SIZE = 16;
export const EVENT_KEY_MAC_KEY_SIZE = 32;
export const NONCE_KEY_SIZE = 32;
export const RADIO_KEY_SIZE = 32;
export const RADIO_MAC_KEY_SIZE = 32;

/** §5 HKDF salt and info strings. */
export const KDF_SALT = 'tesel/v1';
export const KDF_INFO_GROUP_ID = 'group-id';
export const KDF_INFO_CONTENT_KEY = 'content-key';
export const KDF_INFO_EVENT_KEY = 'event-key';
export const KDF_INFO_NONCE_KEY = 'nonce-key';
export const KDF_INFO_RADIO_KEY = 'radio-key';
export const KDF_INFO_RADIO_MAC_KEY = 'radio-mac';

/**
 * §5.1 AES-GCM nonce and tag sizes, and the resulting largest envelope: that of the largest event
 * a decoder accepts, since events written before radio frames were sealed still travel this way.
 */
export const ENVELOPE_NONCE_SIZE = 12;
export const ENVELOPE_TAG_SIZE = 16;
export const MAX_ENVELOPE_SIZE = ENVELOPE_NONCE_SIZE + MAX_DECODABLE_EVENT_SIZE + ENVELOPE_TAG_SIZE;
/** §5.1 The smallest envelope: an event with an empty payload. */
export const MIN_ENVELOPE_SIZE = ENVELOPE_NONCE_SIZE + HEADER_SIZE + ENVELOPE_TAG_SIZE;

/** §6 Invitation token. */
export const INVITATION_VERSION = 1;
export const GROUP_NAME_MAX_BYTES = 32;
export const SERVER_URL_MAX_BYTES = 200;

/** §8 WebSocket endpoint, relative to the server base URL. */
export const RELAY_PATH = 'v1/ws';

/** §8 A server's store identity: random bytes created with its database. */
export const STORE_ID_SIZE = 16;

/** §8.1 Server information endpoint, relative to the server base URL. */
export const SERVER_INFO_PATH = 'healthz';

/** §8.2 Weather warnings endpoint, relative to the server base URL. */
export const WEATHER_WARNINGS_PATH = 'v1/weather-warnings';

/**
 * §7.1 MeshCore application identifier of sealed frames, in MeshCore's development range until
 * registered. It follows 0xFF4D, which carried events unsealed and is now ignored.
 */
export const MESHCORE_DATA_TYPE = 0xff4e;

/** §7.2 Meshtastic port of Tesel events: PRIVATE_APP, the port Meshtastic leaves to private apps. */
export const MESHTASTIC_PORTNUM = 256;

/** §10 Log files: the value of their `tesel` field and the layout version this code writes. */
export const LOG_FILE_KIND = 'log';
export const LOG_FILE_VERSION = 1;
