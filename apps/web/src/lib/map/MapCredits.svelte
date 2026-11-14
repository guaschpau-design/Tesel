<!-- The map's credits, small over its bottom-left corner when it is mounted — as the map opens and
     whenever its base map changes (workspace/MapWorkspace.svelte) — until the map is moved or for
     five seconds; then only in the layers panel, as OpenStreetMap's attribution guidelines allow
     (ADR-0039). -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  interface Props {
    map: MapLibreMap;
    /** Each source's attribution, as HTML of our own (style/style-credits.svelte.ts). */
    credits: readonly string[];
  }

  let { map, credits }: Props = $props();

  const SHOWN_MS = 5000;

  let shown = $state(true);

  onMount(() => {
    const hide = () => {
      shown = false;
    };
    const timer = setTimeout(hide, SHOWN_MS);
    map.on('movestart', hide);
    return () => {
      clearTimeout(timer);
      map.off('movestart', hide);
    };
  });
</script>

{#if shown && credits.length > 0}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- the credits are constants of the app -->
  <p class="credits">{@html credits.join(' · ')}</p>
{/if}

<style>
  /* Above the SOS button (4 rem, 0.75 rem off the edge: workspace/Dock.svelte), as small as can
     be read. */
  .credits {
    position: absolute;
    bottom: var(--dock-clearance);
    left: max(0.75rem, env(safe-area-inset-left));
    z-index: var(--layer-dock);
    max-width: min(26rem, 70vw);
    margin: 0;
    color: var(--map-text);
    font-size: 0.7rem;
    text-shadow: 0 0 3px var(--map-halo);
    pointer-events: auto;
  }

  /* A phone held sideways (ADR-0130): at the foot of the map, past the rail and the SOS button. */
  @media (orientation: landscape) and (max-height: 32rem) {
    .credits {
      left: var(--side-clearance);
    }
  }

  .credits :global(a) {
    color: inherit;
  }
</style>
