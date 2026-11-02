<!-- Guidance to a point, which may move: a line there on the map, and how far and which way. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { DeviceFix } from '../position/device-location.svelte.ts';
  import ClimbLine from '../terrain/ClimbLine.svelte';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import { legBetween } from './leg.ts';
  import NavigationBar from './NavigationBar.svelte';
  import NavigationLayer from './NavigationLayer.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    name: string;
    /** Where the target is now; null once it has left the map. */
    to: LatLon | null;
    fix: DeviceFix | null;
    onstop: () => void;
  }

  let { t, locale, map, name, to, fix, onstop }: Props = $props();

  const leg = $derived(fix && to && legBetween(fix.at, to, fix.accuracy));
</script>

<NavigationLayer {map} from={fix?.at ?? null} {to} />
<NavigationBar
  {t}
  {map}
  title={t('navigatingTo', { name })}
  leg={leg && !leg.arrived ? leg : null}
  {onstop}
>
  <p>
    {#if to === null}
      {t('navigationTargetGone')}
    {:else if leg === null}
      {t('navigationWaitingFix')}
    {:else if leg.arrived}
      {t('navigationArrived')}
    {:else}
      <strong>{formatDistance(leg.metres, locale)}</strong> · {formatBearing(leg.bearing, locale)}
    {/if}
  </p>
  {#if terrain.reader && fix && to && leg && !leg.arrived}
    <ClimbLine {t} from={fix.at} {to} terrain={terrain.reader} />
  {/if}
</NavigationBar>
