<!-- The map's scale, under the map's controls on the right: with the other instruments of the map
     (north, this device, layers), clear of the status cards above the map, the SOS button and the
     dock below it, and the panels that open from the bottom on a phone. -->
<script lang="ts">
  import { ScaleControl, type Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  interface Props {
    map: MapLibreMap;
  }

  let { map }: Props = $props();

  /** Narrow enough not to reach far into the map. */
  const MAX_WIDTH_PX = 80;

  onMount(() => {
    const scale = new ScaleControl({ unit: 'metric', maxWidth: MAX_WIDTH_PX });
    // Added after the controls, so MapLibre puts it below them.
    map.addControl(scale, 'top-right');
    return () => {
      map.removeControl(scale);
    };
  });
</script>

<style>
  /* MapLibre's scale, in the map's own colours: a line and its distance, no box around them. */
  :global(.maplibregl-ctrl-top-right .maplibregl-ctrl-scale) {
    padding: 0 0.2rem;
    color: var(--map-text);
    font-size: var(--text-small);
    text-shadow: 0 0 2px var(--map-halo);
    background: none;
    border: 2px solid var(--map-text);
    border-top: 0;
  }

  /* A phone held sideways (ADR-0130) has no height for the scale under the controls: it goes
     beside them, at their foot. */
  @media (orientation: landscape) and (max-height: 32rem) {
    :global(.maplibregl-ctrl-top-right) {
      display: flex;
      flex-direction: row-reverse;
      align-items: flex-end;
    }
  }
</style>
