// Tesel's own seal on what goes by radio (protocol §5.2, ADR-0099). The radio session seals every
// event it puts on the air and opens every frame it hears here, and nowhere else: the radio links
// carry frames without knowing what is in them.

import {
  deriveGroupKeys,
  openRadioFrame,
  sealRadioFrame,
  toBase64url,
  type GroupKeys,
} from '@tesel/protocol';

/** Seals and opens frames with the keys of the group whose channel they travel on. */
export class RadioFrames {
  /** Each group's keys by its secret, derived the first time the group's channel is used. */
  readonly #keys = new Map<string, GroupKeys>();

  /** The frame that carries `event` on the channel of `secret`; null if the event is too large. */
  seal(secret: Uint8Array, event: Uint8Array): Uint8Array | null {
    return sealRadioFrame(this.#keysOf(secret), event);
  }

  /** The event in a frame heard on the channel of `secret`; null if the group did not seal it. */
  open(secret: Uint8Array, frame: Uint8Array): Uint8Array | null {
    return openRadioFrame(this.#keysOf(secret), frame);
  }

  #keysOf(secret: Uint8Array): GroupKeys {
    const id = toBase64url(secret);
    const known = this.#keys.get(id);
    if (known !== undefined) return known;
    const keys = deriveGroupKeys(secret);
    this.#keys.set(id, keys);
    return keys;
  }
}
