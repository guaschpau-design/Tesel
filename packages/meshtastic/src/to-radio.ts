// What Tesel writes to a Meshtastic radio: `ToRadio` messages (ADR-0098). Fields at their default
// value are left out, as protobuf encoders do.

import { ProtoWriter } from './protobuf.ts';
import {
  ADMIN_MESSAGE,
  CHANNEL,
  CHANNEL_ROLE,
  CHANNEL_SETTINGS,
  DATA,
  MESH_PACKET,
  TO_RADIO,
} from './schema.ts';

/** A channel of the radio: index 0 to 7, its role, key and name. */
export interface ChannelEntry {
  readonly index: number;
  readonly role: keyof typeof CHANNEL_ROLE;
  /** The channel key: empty for none, 1 byte for one of Meshtastic's well-known keys, or 16/32. */
  readonly psk: Uint8Array;
  readonly name: string;
}

/** A packet for the radio to send: who to, on which channel, and what. */
export interface OutgoingPacket {
  readonly to: number;
  readonly channel: number;
  readonly id: number;
  /** How many times the mesh may repeat it; 0 lets the radio decide. */
  readonly hopLimit: number;
  readonly portnum: number;
  readonly payload: Uint8Array;
}

/** Asks the radio for its configuration; it answers until `config_complete_id` echoes `nonce`. */
export function wantConfig(nonce: number): Uint8Array {
  return new ProtoWriter().varint(TO_RADIO.wantConfigId, nonce).finish();
}

export function toRadioPacket(packet: OutgoingPacket): Uint8Array {
  const meshPacket = new ProtoWriter().fixed32(MESH_PACKET.to, packet.to);
  if (packet.channel !== 0) meshPacket.varint(MESH_PACKET.channel, packet.channel);
  meshPacket.message(MESH_PACKET.decoded, data(packet.portnum, packet.payload));
  meshPacket.fixed32(MESH_PACKET.id, packet.id);
  if (packet.hopLimit !== 0) meshPacket.varint(MESH_PACKET.hopLimit, packet.hopLimit);
  return new ProtoWriter().message(TO_RADIO.packet, meshPacket).finish();
}

/** The `Data` a packet carries: an application's port and its bytes. */
export function data(portnum: number, payload: Uint8Array): ProtoWriter {
  const written = new ProtoWriter().varint(DATA.portnum, portnum);
  return payload.length > 0 ? written.bytes(DATA.payload, payload) : written;
}

/** An `AdminMessage` that sets one of the radio's channels. */
export function setChannel(channel: ChannelEntry): Uint8Array {
  const settings = new ProtoWriter();
  if (channel.psk.length > 0) settings.bytes(CHANNEL_SETTINGS.psk, channel.psk);
  if (channel.name !== '') settings.string(CHANNEL_SETTINGS.name, channel.name);
  const entry = new ProtoWriter();
  if (channel.index !== 0) entry.varint(CHANNEL.index, channel.index);
  entry.message(CHANNEL.settings, settings);
  const role = CHANNEL_ROLE[channel.role];
  if (role !== 0) entry.varint(CHANNEL.role, role);
  return new ProtoWriter().message(ADMIN_MESSAGE.setChannel, entry).finish();
}
