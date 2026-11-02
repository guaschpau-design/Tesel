// The field numbers and values of the Meshtastic messages Tesel exchanges with a radio. They are
// interoperability facts, taken from Meshtastic's public protocol definitions (meshtastic/protobufs:
// mesh.proto, channel.proto, config.proto, admin.proto, portnums.proto); the code that uses them is
// Tesel's own (ADR-0098).

export const TO_RADIO = { packet: 1, wantConfigId: 3 } as const;

export const FROM_RADIO = {
  packet: 2,
  myInfo: 3,
  nodeInfo: 4,
  config: 5,
  configCompleteId: 7,
  rebooted: 8,
  channel: 10,
  queueStatus: 11,
} as const;

export const MESH_PACKET = {
  from: 1,
  to: 2,
  channel: 3,
  decoded: 4,
  id: 6,
  rxTime: 7,
  rxSnr: 8,
  hopLimit: 9,
} as const;

export const DATA = { portnum: 1, payload: 2 } as const;

export const MY_NODE_INFO = { myNodeNum: 1 } as const;

export const NODE_INFO = { num: 1, user: 2, position: 3, lastHeard: 5 } as const;

export const USER = { longName: 2, shortName: 3 } as const;

export const POSITION = { latitudeI: 1, longitudeI: 2, time: 4 } as const;

export const CONFIG = { lora: 6 } as const;

export const LORA_CONFIG = {
  usePreset: 1,
  modemPreset: 2,
  bandwidth: 3,
  spreadFactor: 4,
  codingRate: 5,
  hopLimit: 8,
} as const;

export const CHANNEL = { index: 1, settings: 2, role: 3 } as const;

export const CHANNEL_SETTINGS = { psk: 2, name: 3 } as const;

export const QUEUE_STATUS = { res: 1, meshPacketId: 4 } as const;

export const ADMIN_MESSAGE = { setChannel: 33 } as const;

/** `Channel.Role`. */
export const CHANNEL_ROLE = { disabled: 0, primary: 1, secondary: 2 } as const;

/** `PortNum` values Tesel reads or writes; Tesel's own is in @tesel/protocol (protocol §7.2). */
export const PORT = { textMessage: 1, position: 3, nodeInfo: 4, admin: 6 } as const;

/** The `to` of a packet for every node. */
export const BROADCAST = 0xffffffff;
