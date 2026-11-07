// Shares this device's position with the active group in the mode the user chose
// (position-mode.ts). The choice is remembered, so sharing resumes after the app restarts.

import type { Preference } from '../settings/preference.svelte.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import type { DeviceFix, DeviceLocation } from './device-location.svelte.ts';
import type { PositionMode } from './position-mode.ts';
import { ReportPolicy } from './report-policy.ts';

export class PositionSharing {
  readonly #mode: Preference<PositionMode>;
  readonly #location: DeviceLocation;
  /** Hides the position in the groups other than the active one (hide-position.ts). */
  readonly #hideElsewhere: () => Promise<void>;
  #feed: GroupFeed | null = null;
  /** Lets go of the GPS; set while sharing. */
  #release: (() => void) | null = null;
  #policy = new ReportPolicy();

  constructor(
    mode: Preference<PositionMode>,
    location: DeviceLocation,
    hideElsewhere: () => Promise<void>,
  ) {
    this.#mode = mode;
    this.#location = location;
    this.#hideElsewhere = hideElsewhere;
  }

  get mode(): PositionMode {
    return this.#mode.value;
  }

  /**
   * Starts serving a group's feed with the remembered mode. Publishes nothing by itself, except
   * to hide a position the group still sees, shared before the user hid it in another group.
   */
  attach(feed: GroupFeed): void {
    this.detach();
    this.#feed = feed;
    if (this.mode === 'sharing') this.#startReporting();
    if (this.mode === 'hidden' && feed.showsOwnPosition) {
      feed.hidePosition().catch((error: unknown) => {
        console.warn('Hiding the position failed', error);
        storageRefusals.note(error);
      });
    }
  }

  /** Stops reporting, for instance when the active group changes. */
  detach(): void {
    this.#stopReporting();
    this.#feed = null;
  }

  /**
   * Changes the mode. Reporting stops before the choice is stored, so no position is shared after
   * the user turned sharing off.
   */
  async setMode(mode: PositionMode): Promise<void> {
    if (mode !== 'sharing') this.#stopReporting();
    await this.#mode.set(mode);
    if (mode === 'sharing') this.#startReporting();
    if (mode !== 'hidden') return;
    await this.#feed?.hidePosition();
    // The other groups are told meanwhile; the switch does not wait for them.
    this.#hideElsewhere().catch((error: unknown) => {
      console.warn('Hiding the position in the other groups failed', error);
      storageRefusals.note(error);
    });
  }

  #startReporting(): void {
    if (this.#release !== null) return;
    this.#policy = new ReportPolicy();
    this.#release = this.#location.use((fix) => {
      this.#report(fix).catch((error: unknown) => {
        console.warn('Sharing a position failed', error);
        storageRefusals.note(error);
      });
    });
  }

  #stopReporting(): void {
    this.#release?.();
    this.#release = null;
  }

  async #report(fix: DeviceFix): Promise<void> {
    const feed = this.#feed;
    if (feed === null) return;
    const next = this.#policy.next(fix, Math.floor(fix.time / 1000));
    if (next === null) return;
    // A heartbeat publishes the place last published again: a device standing still stays put.
    const last = this.#policy.last;
    const shared: DeviceFix =
      next === 'again' && last !== null
        ? { at: last.at, accuracy: last.accuracy, heading: null, speed: null, time: fix.time }
        : fix;
    await feed.sharePosition(shared);
  }
}
