// The other Meshtastic nodes a radio has heard: who they are and where they last said they were.
// People who carry a Meshtastic radio without Tesel show up only this way, so a Meshtastic link
// offers them beside the RadioLink contract (MeshtasticRadio.onNode, ADR-0098).

import type { NodeRecord, PositionFix, UserInfo } from './from-radio.ts';

export interface MeshtasticNode {
  /** The node's number as Meshtastic shows it: "!" and 8 hex digits. */
  readonly id: string;
  /** The names its owner gave it, or null until it has said them. */
  readonly longName: string | null;
  readonly shortName: string | null;
  /** Where it last said it was, with when by its clock, or null if it never did. */
  readonly position: PositionFix | null;
  /** Seconds since the epoch when it was last heard, 0 if unknown. */
  readonly lastHeard: number;
}

/** What was heard of a node at one time: its names, its position, or neither. */
interface Heard {
  readonly user?: UserInfo | null;
  readonly position?: PositionFix | null;
  readonly at: number;
}

/** Every node heard, by number; each change gives the node as it now stands. */
export class NodeBook {
  readonly #nodes = new Map<number, MeshtasticNode>();

  /** A node the radio already knew when it connected. */
  learn(record: NodeRecord): MeshtasticNode {
    return this.heard(record.num, {
      user: record.user,
      position: record.position,
      at: record.lastHeard,
    });
  }

  heard(num: number, { user, position, at }: Heard): MeshtasticNode {
    const known = this.#nodes.get(num);
    const node: MeshtasticNode = {
      id: nodeId(num),
      longName: user ? nameOrNull(user.longName) : (known?.longName ?? null),
      shortName: user ? nameOrNull(user.shortName) : (known?.shortName ?? null),
      position: position ?? known?.position ?? null,
      lastHeard: Math.max(at, known?.lastHeard ?? 0),
    };
    this.#nodes.set(num, node);
    return node;
  }

  /** The name to show for a node: its long name, or its id until it has said one. */
  nameOf(num: number): string {
    return this.#nodes.get(num)?.longName ?? nodeId(num);
  }
}

/** Meshtastic's way to write a node number: "!" and 8 hex digits. */
function nodeId(num: number): string {
  return `!${num.toString(16).padStart(8, '0')}`;
}

function nameOrNull(name: string): string | null {
  return name === '' ? null : name;
}
