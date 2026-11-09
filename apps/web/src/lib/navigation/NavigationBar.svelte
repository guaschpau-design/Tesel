<!-- While navigating: the card with where to, an arrow that points the way on the map, what the
     guidance says and the button to stop. PointGuide and RouteGuide fill it. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack, type Snippet } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import type { Leg } from './leg.ts';
  import { navigation } from './navigation.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    title: string;
    /** The way to go now, how far and which way; null hides the arrow. */
    leg: Leg | null;
    /** A colour of meaning for the card's edge, as MapCard takes it. */
    edge?: string | undefined;
    /** What the guidance says. */
    children: Snippet;
    /** Buttons beside the one to stop. */
    actions?: Snippet;
    onstop: () => void;
  }

  let { t, map, title, leg, edge, children, actions, onstop }: Props = $props();
  const bearing = $derived(leg?.bearing ?? null);

  // Pocket mode shows the way too (power/PocketScreen.svelte).
  $effect(() => {
    navigation.leg = leg;
    return () => {
      navigation.leg = null;
    };
  });

  /** The map may be turned; the arrow points the way on the map as it is shown. */
  let mapBearing = $state(0);

  /**
   * The arrow's turn, in degrees, kept unbounded: each change takes the shortest way, so the arrow
   * swings past north rather than spinning the long way round.
   */
  let turn = $state(0);
  $effect(() => {
    if (bearing === null) return;
    const target = bearing - mapBearing;
    untrack(() => {
      turn += ((((target - turn) % 360) + 540) % 360) - 180;
    });
  });

  onMount(() => {
    const turned = () => {
      mapBearing = map.getBearing();
    };
    turned();
    map.on('rotate', turned);
    return () => {
      map.off('rotate', turned);
    };
  });
</script>

<MapCard label={title} {edge}>
  <div class="navigation">
    {#if bearing !== null}
      <span class="arrow" style:rotate="{turn}deg">
        <Pictogram name="heading" size={28} />
      </span>
    {/if}
    <div class="what">
      <p class="name">{title}</p>
      <div class="hint">{@render children()}</div>
    </div>
    <div class="actions">
      {@render actions?.()}
      <button onclick={onstop}>{t('navigationStop')}</button>
    </div>
  </div>
</MapCard>

<style>
  .navigation {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .arrow {
    display: grid;
    place-items: center;
    color: var(--accent-line);
    transition: rotate 0.3s;
  }

  .what {
    flex: 1;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: flex-end;
  }
</style>
