<!-- Shows its content as a group of the map's controls, in one of the map's corners. -->
<script lang="ts">
  import type { ControlPosition, IControl, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    map: MapLibreMap;
    position?: ControlPosition;
    children: Snippet;
  }

  let { map, position = 'top-right', children }: Props = $props();

  let element: HTMLDivElement;

  onMount(() => {
    // MapLibre moves the element into its corner, where Svelte keeps updating it and removes it
    // when the component goes, so there is nothing to undo on removal.
    const control: IControl = { onAdd: () => element, onRemove: () => undefined };
    map.addControl(control, position);
    return () => {
      map.removeControl(control);
    };
  });
</script>

<div class="maplibregl-ctrl maplibregl-ctrl-group chrome" bind:this={element}>
  {@render children()}
</div>

<style>
  /* Chrome, like the dock: ink, round like what floats on the map, with buttons a finger can hit.
     MapLibre's own look for control groups is replaced, its white background too, which its
     stylesheet would otherwise give back over .chrome. */
  div {
    overflow: hidden;
    background: var(--chrome-bg);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-float);
  }

  div :global(button) {
    display: grid;
    place-items: center;
    width: var(--control-size);
    height: var(--control-size);
    padding: 0;
    color: inherit;
    border: 0;
    border-radius: 0;
  }

  div :global(button + button) {
    border-top: 1px solid var(--chrome-line);
  }

  div :global(button:hover) {
    background: var(--chrome-pressed);
  }

  /* Too low a screen for one column (app.css): two, filled top to bottom, split by a line. */
  @media (orientation: landscape) and (max-height: 22rem) {
    div {
      display: grid;
      grid-auto-flow: column;
      grid-template-rows: repeat(3, var(--control-size));
      gap: 1px;
      background: var(--chrome-line);
    }

    div :global(button) {
      background: var(--chrome-bg);
    }

    div :global(button + button) {
      border-top: 0;
    }
  }
</style>
