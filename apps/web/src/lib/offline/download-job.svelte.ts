// The download of an area for offline use, as the interface follows it: its progress, why it
// stopped short if it did, and cancelling it. A download that stopped short can be resumed. There
// is one on the device (`offlineDownload`), which goes on while the map is used: the panel that
// started it can be closed, and a card on the map follows it meanwhile.

import {
  countAreaTiles,
  downloadArea,
  SourceUnreachable,
  type DownloadLayer,
} from '../map/tiles/area-download.ts';
import type { Bounds } from '../map/tiles/math.ts';
import type { TileStore } from '../map/tiles/store.ts';
import type { OfflineArea } from '../map/tiles/store-schema.ts';
import { isStorageFull, keepStorage, roomForMaps } from '../storage/storage-space.svelte.ts';
import { bytesStillNeeded, type DownloadFailure } from './offline-maps.ts';

export interface DownloadPlan {
  readonly name: string;
  readonly bounds: Bounds;
  readonly layers: readonly DownloadLayer[];
  /** The incomplete area this download resumes: it keeps its id and its date. */
  readonly resumes?: OfflineArea;
}

export class DownloadJob {
  /** Tiles done out of the total while downloading, or null. */
  progress: { readonly done: number; readonly total: number } | null = $state(null);
  /** Why the last download stopped short, or null if it did not (or was cancelled). */
  failure: DownloadFailure | null = $state.raw(null);
  /** The name of the area being downloaded, or last downloaded. */
  name = $state('');
  /** Whether the last download was cancelled by the user. */
  cancelled = false;
  #controller: AbortController | null = null;

  get running(): boolean {
    return this.progress !== null;
  }

  /**
   * Downloads `plan` into `store`, if there is room for it and for the group's log. Resolves to
   * true once the whole area is stored, false otherwise; it never rejects.
   */
  async run(store: TileStore, plan: DownloadPlan): Promise<boolean> {
    if (this.running) return false;
    this.failure = null;
    this.cancelled = false;
    this.name = plan.name;
    // Running, and so cancellable, from the start: the check for room takes a moment too.
    const controller = new AbortController();
    this.#controller = controller;
    this.progress = { done: 0, total: countAreaTiles(plan.bounds, plan.layers) };
    try {
      const needed = await bytesStillNeeded(store, plan.bounds, plan.layers);
      const room = await roomForMaps();
      if (controller.signal.aborted) return false;
      if (room !== null && room < needed) {
        this.failure = { kind: 'no-room', needed, free: room };
        return false;
      }
      const area = await downloadArea(store, {
        id: plan.resumes?.id ?? crypto.randomUUID(),
        createdAt: plan.resumes?.createdAt ?? Date.now(),
        name: plan.name,
        bounds: plan.bounds,
        layers: plan.layers,
        signal: controller.signal,
        onProgress: ({ done, total }) => (this.progress = { done, total }),
      });
      await keepStorage();
      if (!area.complete) this.failure = { kind: 'incomplete' };
      return area.complete;
    } catch (error) {
      // Cancelled by the user: nothing to tell.
      if (!controller.signal.aborted) {
        console.warn('Offline area download stopped', error);
        this.failure = failureOf(error);
      }
      return false;
    } finally {
      this.progress = null;
      this.#controller = null;
    }
  }

  cancel(): void {
    if (this.#controller === null) return;
    this.cancelled = true;
    this.#controller.abort();
  }
}

function failureOf(error: unknown): DownloadFailure {
  if (isStorageFull(error)) return { kind: 'storage-full' };
  if (error instanceof SourceUnreachable) return { kind: 'unreachable' };
  return { kind: 'failed' };
}

/** The device's one download of an offline area at a time. */
export const offlineDownload = new DownloadJob();
