<!-- How far a point is from this device and which way, and below it the "Elevation" fold: opened,
     the profile of the straight way there, drawn to scale, and how much it climbs and descends
     (ADR-0115). Where there is no room for the fold (a card on the map), the climb is one line,
     with the relief on. While shown, it keeps the GPS on if the user has already let the app use
     it: it never asks for the permission by itself, as opening a point is not asking to be
     located. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import { climbMetres } from '../terrain/climb.ts';
  import ClimbLine from '../terrain/ClimbLine.svelte';
  import ClimbProfile from '../terrain/ClimbProfile.svelte';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import { WayClimb } from '../terrain/way-climb.svelte.ts';
  import { legBetween } from './leg.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    at: LatLon;
    /** The elevation fold; without it, the climb in one line while the relief is on. */
    profile?: boolean;
  }

  let { t, locale, at, profile = true }: Props = $props();

  onMount(() => {
    let release: (() => void) | null = null;
    let gone = false;
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!gone && status.state === 'granted') release = deviceLocation.use();
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      release?.();
    };
  });

  const leg = $derived(deviceLocation.fix && legBetween(deviceLocation.fix.at, at));

  /** The fold has been opened: from then on the way is read, and its gist shown when closed. */
  let asked = $state(false);
  const way = new WayClimb(
    () => (deviceLocation.fix ? { from: deviceLocation.fix.at, to: at } : null),
    () => (profile && (asked || terrain.reader) ? terrain.onDemand : null),
  );
  const gist = $derived(
    way.current?.climb
      ? t('climbShort', {
          up: climbMetres(way.current.climb.up),
          down: climbMetres(way.current.climb.down),
        })
      : '',
  );
</script>

{#if leg && deviceLocation.fix}
  <p class="from-here">
    {t('fromHere', {
      distance: formatDistance(leg.metres, locale),
      bearing: formatBearing(leg.bearing, locale),
    })}
  </p>
  {#if profile && terrain.onDemand}
    <Fold title={t('elevation')} summary={gist} onopen={() => (asked = true)}>
      <ClimbProfile {t} {locale} way={way.current} length={leg.metres} />
    </Fold>
  {:else if terrain.reader}
    <ClimbLine {t} from={deviceLocation.fix.at} to={at} terrain={terrain.reader} />
  {/if}
{/if}

<style>
  .from-here {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
