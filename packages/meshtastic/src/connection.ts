// An open connection to a Meshtastic radio, as the link uses it. Keeping it small makes the radio
// easy to fake in tests; `web-ble.ts` implements it over Web Bluetooth.

import type { LoraSettings, MeshPacket, NodeRecord } from './from-radio.ts';
import type { ChannelEntry, OutgoingPacket } from './to-radio.ts';

/** What the radio told when it connected. */
export interface RadioSetup {
  readonly myNodeNum: number;
  /** Its channels, disabled ones included. */
  readonly channels: readonly ChannelEntry[];
  /** Its LoRa settings, if it told them. */
  readonly lora: LoraSettings | null;
  /** The other nodes it knew. */
  readonly nodes: readonly NodeRecord[];
}

/** What the radio says once connected: a packet it heard, or news of a node. */
export type Incoming =
  | { readonly kind: 'packet'; readonly packet: MeshPacket }
  | { readonly kind: 'node'; readonly node: NodeRecord };

export interface MeshtasticConnection {
  readonly setup: RadioSetup;
  /**
   * Hands a packet to the radio, with an id of its own. Resolves once the radio has taken it into
   * its queue; rejects with `refused` if it would not.
   */
  sendPacket(packet: Omit<OutgoingPacket, 'id'>): Promise<void>;
  /** Subscribes to what the radio says; what it said before anyone listened comes first. */
  onIncoming(listener: (incoming: Incoming) => void): () => void;
  onDisconnected(listener: () => void): () => void;
  close(): Promise<void>;
}
