<!-- Watches which side of the group's areas this member is on, from the fixes the GPS gives while
     something else has it on (zone-watch.ts, ADR-0122): a danger area, the area of a task of
     theirs. Leaving the area of their task is said here at once; while they share their position,
     the group is told of a danger area entered and of the area of their task left, and back.
     Shows nothing of its own. -->
<script lang="ts">
  import type { NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { namedAfter } from './object-names.ts';
  import { dueCrossings, toldCrossings, watchedZones, ZoneWatch } from './zone-watch.ts';

  interface Props {
    t: Translate;
    feed: GroupFeed;
    self: NodeId;
    sharing: PositionSharing;
  }

  let { t, feed, self, sharing }: Props = $props();

  const watch = new ZoneWatch();
  /** The sides borne out, by area, as of the last that changed. */
  let sides = $state.raw(watch.sides());
  const zones = $derived(watchedZones(feed.state, self));

  // Each fix; the areas as they are then, without running again when only they change.
  $effect(() => {
    const fix = deviceLocation.fix;
    if (fix === null) return;
    const changes = watch.see(
      untrack(() => zones),
      fix,
    );
    for (const { zone, side, before } of changes) {
      if (zone.kind !== 'assigned' || side !== 'outside' || before !== 'inside') continue;
      // Safari has no vibration API.
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      notices.show(t('zoneLeftOwn', { zone: namedAfter(zone.shape.label, t) }));
    }
    if (changes.length > 0) sides = watch.sides();
  });

  $effect(() => {
    if (sharing.mode !== 'sharing') return;
    const fix = untrack(() => deviceLocation.fix);
    if (fix === null) return;
    const now = Date.now();
    const told = toldCrossings(feed.state.zoneCrossings, self);
    const due = dueCrossings(zones, sides, told, watch.sentAt, now);
    for (const { zone, crossing } of due) {
      watch.sent(zone.key, now);
      feed.tellCrossing(zone.ref, crossing, zone.kind, fix).catch((error: unknown) => {
        console.warn('A zone crossing could not be told', error);
      });
    }
  });
</script>
