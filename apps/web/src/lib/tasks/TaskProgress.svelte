<!-- Under a task on a member's card, how far they are with it (ADR-0166):
     - when they, or the first of their team, reached its place (task-reach.ts), with a green dot;
     - that they are there;
     - or what they have left (task-left.ts) and how long it takes on foot, with its climb once
       read (ADR-0156), or at their speed while they go faster than on foot.
     Nothing for a task without a place, or a member whose position is unknown or hidden. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import { formatClock, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import { walkDuration, walkingMinutes } from '../terrain/walking.ts';
  import { WayClimb } from '../terrain/way-climb.svelte.ts';
  import StatusDot from '../ui/StatusDot.svelte';
  import { handedAt, positionsSince, wayLeft } from './task-left.ts';
  import { reachOf, taskGoal } from './task-reach.ts';
  import type { TaskRow } from './tasks.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    /** Whose card it is. */
    member: NodeId;
    row: TaskRow;
  }

  let { t, locale, groupState, member, row }: Props = $props();

  /** Faster than this, in metres a second, a member is not on foot: their speed tells the time. */
  const VEHICLE_M_S = 4;
  /** What a way without known elevations climbs, for a time on foot all the same. */
  const FLAT = { up: 0, down: 0 } as const;

  const reach = $derived(reachOf(groupState, row.key, member));
  const goal = $derived(taskGoal(row.fields.place, groupState.objects));
  /** Since when the task has been theirs where it is: their positions from then on count. */
  const since = $derived(handedAt(groupState.journal, row.key));
  const positions = $derived.by(() => {
    const trail = groupState.trails.get(member)?.points ?? [];
    return since === null ? [] : positionsSince(trail, since);
  });
  const left = $derived(goal !== null && reach === null ? wayLeft(goal, positions) : null);
  const speed = $derived(positions.at(-1)?.speed ?? null);
  const driving = $derived(speed !== null && speed >= VEHICLE_M_S);

  /** The way left, read for how much it climbs while on foot. */
  const climbing = new WayClimb(
    () => (left !== null && left.metres > 0 && !driving ? left.way : null),
    () => terrain.onDemand,
  );

  const duration = $derived.by(() => {
    if (left === null || left.metres === 0) return null;
    if (driving && speed !== null) {
      return t('taskLeftDriving', { duration: walkDuration(t, left.metres / speed / 60) });
    }
    const read = climbing.current !== null && !climbing.reading;
    const climb = climbing.current?.climb ?? (read || terrain.onDemand === null ? FLAT : null);
    if (climb === null) return null;
    return t('walkOnFoot', { duration: walkDuration(t, walkingMinutes(left.metres, climb)) });
  });

  const said = $derived.by(() => {
    if (reach !== null) {
      const time = formatClock(reach.time * 1000, locale);
      return reach.origin === member
        ? t('taskReachedAt', { time })
        : t('taskReachedByAt', { name: aliasOf(groupState, reach.origin), time });
    }
    if (left === null) return null;
    if (left.metres === 0) return t('taskAtPlace');
    const distance = formatDistance(left.metres, locale);
    const far = t(left.straight ? 'taskLeftStraight' : 'taskLeftWay', { distance });
    return duration === null ? far : `${far} · ${duration}`;
  });
</script>

{#if said !== null}
  <p class="hint line">
    {#if reach !== null}<StatusDot tone="good" />{/if}
    {said}
  </p>
{/if}

<style>
  .line {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin: 0;
  }
</style>
