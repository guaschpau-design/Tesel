// Whether a relay link is still there (protocol §8): a link silent for a while is asked with a ping,
// and given up if nothing comes back. A connection that died without closing, as on a phone that
// changed networks, is noticed within 45 seconds instead of looking synced for ever.

import { encodeRelayMessage } from '@tesel/protocol';

/** A link silent this long is asked whether it is still there... */
const QUIET_MS = 25_000;
/** ...and given up if nothing comes back within this span more. */
const PONG_TIMEOUT_MS = 20_000;

export class RelayHeartbeat {
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** The link said something: it is alive, and is asked again only after a quiet spell. */
  heard(socket: { send(text: string): void }, onSilent: () => void): void {
    this.stop();
    this.#timer = setTimeout(() => {
      socket.send(encodeRelayMessage({ t: 'ping' }));
      this.#timer = setTimeout(() => {
        this.#timer = null;
        onSilent();
      }, PONG_TIMEOUT_MS);
    }, QUIET_MS);
  }

  stop(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
