// What a Meshtastic radio tells Tesel: `FromRadio` messages, read into plain values (ADR-0098).
// Only what Tesel uses is read; everything else the radio says is `other` and let go.

import type { Result } from '@tesel/protocol';

import { ProtoMessage } from './protobuf.ts';
import {
  CHANNEL,
  CHANNEL_ROLE,
  CHANNEL_SETTINGS,
  CONFIG,
  DATA,
  FROM_RADIO,
  LORA_CONFIG,
  MESH_PACKET,
  MY_NODE_INFO,
  NODE_INFO,
  POSITION,
  QUEUE_STATUS,
  USER,
} from './schema.ts';
import type { ChannelEntry } from './to-radio.ts';

/** A packet the radio heard and could decrypt. */
export interface MeshPacket {
  readonly from: number;
  readonly to: number;
  /** The index of the radio's channel it arrived on. */
  readonly channel: number;
  readonly portnum: number;
  readonly payload: Uint8Array;
  /** Seconds since the epoch by the radio's clock when it heard it; 0 if it has no clock. */
  readonly rxTime: number;
  /** Signal-to-noise ratio, in dB. */
  readonly rxSnr: number;
}

/** The radio's LoRa settings, as far as airtime and repeats go. */
export interface LoraSettings {
  readonly usePreset: boolean;
  readonly modemPreset: number;
  /** In kHz, Meshtastic's way: 31 and 62 stand for 31.25 and 62.5. */
  readonly bandwidth: number;
  readonly spreadFactor: number;
  /** The denominator of the coding rate: 5 to 8 for 4/5 to 4/8. */
  readonly codingRate: number;
  readonly hopLimit: number;
}

export interface UserInfo {
  readonly longName: string;
  readonly shortName: string;
}

export interface PositionFix {
  /** Degrees. */
  readonly latitude: number;
  readonly longitude: number;
  /** Seconds since the epoch, 0 if unknown. */
  readonly time: number;
}

/** What the radio knows of another node. */
export interface NodeRecord {
  readonly num: number;
  readonly user: UserInfo | null;
  readonly position: PositionFix | null;
  /** Seconds since the epoch, 0 if unknown. */
  readonly lastHeard: number;
}

export type FromRadio =
  | { readonly kind: 'packet'; readonly packet: MeshPacket }
  | { readonly kind: 'my-info'; readonly myNodeNum: number }
  | { readonly kind: 'node'; readonly node: NodeRecord }
  | { readonly kind: 'lora'; readonly lora: LoraSettings }
  | { readonly kind: 'channel'; readonly channel: ChannelEntry }
  | { readonly kind: 'config-complete'; readonly id: number }
  | { readonly kind: 'queue-status'; readonly packetId: number; readonly res: number }
  | { readonly kind: 'rebooted' }
  | { readonly kind: 'other' };

/** Meshtastic sends coordinates as integers of 1e-7 degrees. */
const DEGREES_PER_UNIT = 1e-7;

export function decodeFromRadio(bytes: Uint8Array): Result<FromRadio, string> {
  const parsed = ProtoMessage.parse(bytes);
  if (!parsed.ok) return parsed;
  return { ok: true, value: fromRadioOf(parsed.value) };
}

function fromRadioOf(message: ProtoMessage): FromRadio {
  const packet = message.message(FROM_RADIO.packet);
  if (packet !== null) {
    const decoded = meshPacketOf(packet);
    return decoded === null ? { kind: 'other' } : { kind: 'packet', packet: decoded };
  }
  const myInfo = message.message(FROM_RADIO.myInfo);
  if (myInfo !== null) {
    return { kind: 'my-info', myNodeNum: myInfo.uint32(MY_NODE_INFO.myNodeNum) ?? 0 };
  }
  const nodeInfo = message.message(FROM_RADIO.nodeInfo);
  if (nodeInfo !== null) return { kind: 'node', node: nodeRecordOf(nodeInfo) };
  const lora = message.message(FROM_RADIO.config)?.message(CONFIG.lora) ?? null;
  if (lora !== null) return { kind: 'lora', lora: loraOf(lora) };
  const channel = message.message(FROM_RADIO.channel);
  if (channel !== null) return { kind: 'channel', channel: channelOf(channel) };
  const completeId = message.uint32(FROM_RADIO.configCompleteId);
  if (completeId !== undefined) return { kind: 'config-complete', id: completeId };
  const queueStatus = message.message(FROM_RADIO.queueStatus);
  if (queueStatus !== null) {
    return {
      kind: 'queue-status',
      packetId: queueStatus.uint32(QUEUE_STATUS.meshPacketId) ?? 0,
      res: queueStatus.int32(QUEUE_STATUS.res) ?? 0,
    };
  }
  if (message.bool(FROM_RADIO.rebooted) === true) return { kind: 'rebooted' };
  return { kind: 'other' };
}

/** A packet with its decoded data; null for one the radio could not decrypt. */
function meshPacketOf(packet: ProtoMessage): MeshPacket | null {
  const data = packet.message(MESH_PACKET.decoded);
  if (data === null) return null;
  return {
    from: packet.fixed32(MESH_PACKET.from) ?? 0,
    to: packet.fixed32(MESH_PACKET.to) ?? 0,
    channel: packet.uint32(MESH_PACKET.channel) ?? 0,
    portnum: data.uint32(DATA.portnum) ?? 0,
    payload: data.bytes(DATA.payload) ?? new Uint8Array(0),
    rxTime: packet.fixed32(MESH_PACKET.rxTime) ?? 0,
    rxSnr: packet.float(MESH_PACKET.rxSnr) ?? 0,
  };
}

function nodeRecordOf(node: ProtoMessage): NodeRecord {
  const user = node.message(NODE_INFO.user);
  const position = node.message(NODE_INFO.position);
  return {
    num: node.uint32(NODE_INFO.num) ?? 0,
    user: user === null ? null : userOf(user),
    position: position === null ? null : positionOf(position),
    lastHeard: node.fixed32(NODE_INFO.lastHeard) ?? 0,
  };
}

/** The names in a `User`, which nodes also send on their own (NODEINFO_APP). */
export function userOf(user: ProtoMessage): UserInfo {
  return {
    longName: user.string(USER.longName) ?? '',
    shortName: user.string(USER.shortName) ?? '',
  };
}

/**
 * A `Position`, which nodes also send on their own (POSITION_APP); null without coordinates, or
 * with coordinates off the Earth: anyone on the public channel can send one.
 */
export function positionOf(position: ProtoMessage): PositionFix | null {
  const latitudeI = position.sfixed32(POSITION.latitudeI);
  const longitudeI = position.sfixed32(POSITION.longitudeI);
  // A node that shares no position sends none, or zeros.
  if (latitudeI === undefined || longitudeI === undefined) return null;
  if (latitudeI === 0 && longitudeI === 0) return null;
  const latitude = latitudeI * DEGREES_PER_UNIT;
  const longitude = longitudeI * DEGREES_PER_UNIT;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, time: position.fixed32(POSITION.time) ?? 0 };
}

function loraOf(lora: ProtoMessage): LoraSettings {
  return {
    usePreset: lora.bool(LORA_CONFIG.usePreset) ?? false,
    modemPreset: lora.uint32(LORA_CONFIG.modemPreset) ?? 0,
    bandwidth: lora.uint32(LORA_CONFIG.bandwidth) ?? 0,
    spreadFactor: lora.uint32(LORA_CONFIG.spreadFactor) ?? 0,
    codingRate: lora.uint32(LORA_CONFIG.codingRate) ?? 0,
    hopLimit: lora.uint32(LORA_CONFIG.hopLimit) ?? 0,
  };
}

function channelOf(channel: ProtoMessage): ChannelEntry {
  const settings = channel.message(CHANNEL.settings);
  return {
    index: channel.int32(CHANNEL.index) ?? 0,
    role: roleOf(channel.uint32(CHANNEL.role) ?? CHANNEL_ROLE.disabled),
    psk: settings?.bytes(CHANNEL_SETTINGS.psk) ?? new Uint8Array(0),
    name: settings?.string(CHANNEL_SETTINGS.name) ?? '',
  };
}

function roleOf(value: number): ChannelEntry['role'] {
  if (value === CHANNEL_ROLE.disabled) return 'disabled';
  if (value === CHANNEL_ROLE.secondary) return 'secondary';
  // A role newer than this code is kept clear of, as the primary channel is.
  return 'primary';
}
