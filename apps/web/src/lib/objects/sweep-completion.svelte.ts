// A search area is marked cleared once every strip of its sweep is done, by the device that
// finished the last one (sweeps.ts), so that every device, older ones too, sees it cleared. Each
// change of an area is marked once, and only when the mark is sure to win (ClearingMarks).

import { ShapeStyleCode, type NodeId } from '@tesel/protocol';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { clockEvery } from '../ui/now.svelte.ts';
import { ClearingMarks } from './sweeps.ts';

/** How often an area waiting for this device's clock is looked at again, in milliseconds. */
const WAITING_CHECK_MS = 10_000;

export function useSweepCompletion(
  group: () => { readonly feed: GroupFeed; readonly self: NodeId } | null,
): void {
  /** Each group's marks: object references are unique within a group only. */
  const marksByFeed = new WeakMap<GroupFeed, ClearingMarks>();
  const marksOf = (feed: GroupFeed): ClearingMarks => {
    const known = marksByFeed.get(feed);
    if (known !== undefined) return known;
    const marks = new ClearingMarks();
    marksByFeed.set(feed, marks);
    return marks;
  };
  const clock = clockEvery(WAITING_CHECK_MS);
  $effect(() => {
    const current = group();
    if (current === null) return;
    const { feed, self } = current;
    const marks = marksOf(feed);
    // While an area waits for this device's clock, the effect runs again as the clock moves on.
    for (const area of marks.due(feed.state, self, () => clock.seconds * 1000)) {
      feed.restyleShape(area, ShapeStyleCode.SEARCH_CLEARED).catch((error: unknown) => {
        console.warn('A swept area could not be marked cleared:', error);
        marks.failed(area);
      });
    }
  });
}
