<!-- Among the map's controls: a needle that points to the north of the map as it turns, and puts
     north back up when pressed; the map lies flat again too, unless the ground is raised in 3D. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { ground } from './ground.svelte.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
  }

  let { t, map }: Props = $props();

  /** Degrees the map is turned clockwise from north. */
  let bearing = $state(0);

  onMount(() => {
    const turned = () => {
      bearing = map.getBearing();
    };
    turned();
    map.on('rotate', turned);
    return () => {
      map.off('rotate', turned);
    };
  });
</script>

<button
  aria-label={t('northUp')}
  title={t('northUp')}
  onclick={() => {
    if (ground.raised) map.resetNorth();
    else map.resetNorthPitch();
  }}
>
  <span style:transform="rotate({-bearing}deg)"><Pictogram name="compass" size={20} /></span>
</button>

<style>
  span {
    display: grid;
  }

  /* The north half of the needle in the colour of danger, as on a compass. */
  span :global(path[fill='currentColor']) {
    fill: var(--danger);
  }
</style>
