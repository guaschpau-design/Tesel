<!-- Tells the group when this member reaches the place of a task of theirs (task-reach.ts,
     protocol §3.19, ADR-0166), from the fixes the GPS gives while something else has it on: only
     while they share their position, as it says where they are, and once for each task. Shows
     nothing of its own. -->
<script lang="ts">
  import type { NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { goalsToReach, ReachWatch } from './task-reach.ts';

  interface Props {
    feed: GroupFeed;
    self: NodeId;
    sharing: PositionSharing;
  }

  let { feed, self, sharing }: Props = $props();

  const watch = new ReachWatch();
  /** The tasks this member is at the place of, as of the last fix that changed them. */
  let reached = $state.raw(watch.reached());
  const goals = $derived(goalsToReach(feed.state, self));

  // Each fix; the places as they are then, without running again when only they change.
  $effect(() => {
    const fix = deviceLocation.fix;
    if (fix === null) return;
    const changed = watch.see(
      untrack(() => goals),
      fix,
    );
    if (changed) reached = watch.reached();
  });

  $effect(() => {
    if (sharing.mode !== 'sharing') return;
    const fix = untrack(() => deviceLocation.fix);
    if (fix === null) return;
    for (const key of reached) {
      const task = goals.has(key) ? feed.state.tasks.get(key) : undefined;
      if (task === undefined || !watch.tellOnce(key)) continue;
      feed.tellReached(task.task, fix).catch((error: unknown) => {
        console.warn('A task reached could not be told', error);
      });
    }
  });
</script>
