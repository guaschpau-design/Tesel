<!-- How much the straight way from here to a point climbs and descends, and its steepest stretch,
     in one line, as guidance shows it. Read again when the device has moved a little or the point
     changes (way-climb.svelte.ts). -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { climbMetres } from './climb.ts';
  import type { ElevationReader } from './elevation.ts';
  import { WayClimb } from './way-climb.svelte.ts';

  interface Props {
    t: Translate;
    from: LatLon;
    to: LatLon;
    terrain: ElevationReader;
  }

  let { t, from, to, terrain }: Props = $props();

  const way = new WayClimb(
    () => ({ from, to }),
    () => terrain,
  );
  const climb = $derived(way.current?.climb ?? null);
</script>

{#if climb}
  <p class="climb">
    {t('climb', {
      up: climbMetres(climb.up),
      down: climbMetres(climb.down),
      steepest: String(Math.round(climb.steepest)),
    })}
  </p>
{/if}

<style>
  .climb {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
