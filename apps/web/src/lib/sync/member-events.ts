// What a member does, as events: each function here gives what one action of the group feed
// publishes, built from the header the event log gives it (sequence number and time included).
// Pure, so the feed is left with sending events and not with their shapes.

import {
  NO_SOS_PLACE,
  type EventHeader,
  type EventRef,
  type LatLon,
  type MarkerEvent,
  type ObjectRef,
  type Role,
  type ShapeEvent,
  type ShapeGeometry,
  type SosKind,
  type TeselEvent,
  type ZoneCrossing,
  type ZoneKind,
} from '@tesel/protocol';

import type { LocalIdentity } from '../identity/identity.ts';
import type { DeviceFix } from '../position/device-location.svelte.ts';
import type { TaskFields } from '../tasks/tasks.ts';
import type { MemberStateFields, ReportFields, TeamFields } from './event-fields.ts';

/** Makes an event from the header the event log gives it. */
export type EventBuilder = (header: EventHeader) => TeselEvent;

/** The reference of the event being built, which a new object takes as its own (protocol §3.10). */
function ownRef(header: EventHeader): ObjectRef {
  return { origin: header.origin, seq: header.seq };
}

/** MEMBER_INFO: who this device is in the group. */
export function memberInfo(role: Role, identity: LocalIdentity): EventBuilder {
  return (header) => ({
    ...header,
    type: 'member-info',
    role,
    publicKey: identity.publicKey,
    alias: identity.alias,
  });
}

export function chat(text: string): EventBuilder {
  return (header) => ({ ...header, type: 'chat', text });
}

export function position({ at, accuracy, heading, speed }: DeviceFix): EventBuilder {
  return (header) => ({ ...header, type: 'position', ...at, accuracy, heading, speed });
}

export function positionHidden(): EventBuilder {
  return (header) => ({ ...header, type: 'position-hidden' });
}

export function newMarker(at: LatLon, symbol: number, label: string): EventBuilder {
  return (header) => ({ ...header, type: 'marker', object: ownRef(header), symbol, ...at, label });
}

export function newShape(geometry: ShapeGeometry, style: number, label: string): EventBuilder {
  return (header) => ({
    ...header,
    type: 'shape',
    object: ownRef(header),
    style,
    label,
    geometry,
  });
}

/** The shape with another style and all else kept (protocol §3.10). */
export function restyledShape(shape: ShapeEvent, style: number): EventBuilder {
  const { object, label, geometry } = shape;
  return (header) => ({ ...header, type: 'shape', object, style, label, geometry });
}

/** One strip of a sweep of `area` (protocol §3.13); the event's reference becomes the strip's. */
export function sweepStrip(
  area: ObjectRef,
  recipe: { readonly spacing: number; readonly heading: number },
  strip: number,
  strips: number,
): EventBuilder {
  return (header) => ({
    ...header,
    type: 'sweep',
    object: ownRef(header),
    area,
    ...recipe,
    strip,
    strips,
  });
}

/** A marker or a shape with another label and symbol or style, where it was. */
export function editedObject(
  record: MarkerEvent | ShapeEvent,
  code: number,
  label: string,
): EventBuilder {
  return (header) =>
    record.type === 'marker'
      ? { ...record, ...header, symbol: code, label }
      : { ...record, ...header, style: code, label };
}

export function objectDelete(object: ObjectRef): EventBuilder {
  return (header) => ({ ...header, type: 'object-delete', object });
}

/** A call for help from `at`, or with no place when this device has no position (§3.8). */
export function sos(
  kind: SosKind,
  at: LatLon | null,
  accuracy: number | null,
  text: string,
): EventBuilder {
  const place = at === null ? NO_SOS_PLACE : { ...at, accuracy };
  return (header) => ({ ...header, type: 'sos', kind, ...place, text });
}

export function sosCancel(call: EventRef): EventBuilder {
  return (header) => ({ ...header, type: 'sos-cancel', sos: call });
}

export function ack(target: EventRef): EventBuilder {
  return (header) => ({ ...header, type: 'ack', target });
}

/**
 * The task `ref` refers to with these fields, or a new task when it is null, whose reference is its
 * own event's (protocol §3.11).
 */
export function task(ref: EventRef | null, fields: TaskFields): EventBuilder {
  return (header) => ({ ...header, type: 'task', task: ref ?? ownRef(header), ...fields });
}

/** MEMBER_STATE (protocol §3.14). */
export function memberState(state: MemberStateFields): EventBuilder {
  return (header) => ({ ...header, type: 'member-state', ...state });
}

/** The group's safety check-in after `minutes`, or off with 0 (protocol §3.17). */
export function checkInTimer(minutes: number): EventBuilder {
  return (header) => ({ ...header, type: 'check-in-timer', minutes });
}

/** A situation report (protocol §3.16). */
export function report(fields: ReportFields): EventBuilder {
  return (header) => ({ ...header, type: 'report', ...fields });
}

/** A team, new or changed (protocol §3.15). */
export function team(fields: TeamFields): EventBuilder {
  return (header) => ({ ...header, type: 'team', ...fields });
}

/** This member crossed the edge of an area, at this fix (protocol §3.18). */
export function zoneCrossing(
  zone: ObjectRef,
  crossing: ZoneCrossing,
  kind: ZoneKind,
  { at, accuracy }: Pick<DeviceFix, 'at' | 'accuracy'>,
): EventBuilder {
  return (header) => ({ ...header, type: 'zone-crossing', zone, crossing, kind, ...at, accuracy });
}
