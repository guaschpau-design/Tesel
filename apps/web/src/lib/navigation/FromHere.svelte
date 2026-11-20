<!-- How far a point is from this device and which way, and below it the "Elevation" fold: opened,
     the profile of the straight way there, drawn to scale, and how much it climbs and descends
     (ADR-0115). Under it, how long the way takes on foot and, when asked for, the light there
     (ADR-0156, ADR-0157) and whether a radio reaches it (ADR-0159). Where there is no room for the
     fold (a card on the map), the climb is one line, with the relief on. While shown, it keeps the GPS on if the user has already let the app use
     it: it never asks for the permission by itself, as opening a point is not asking to be
     located. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import WalkLight from '../daylight/WalkLight.svelte';
  import { formatBearing, formatDistance } from '../format.ts';
  import { bearings } from './bearings.svelte.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { BaseMap } from '../map/style/style.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import { climbMetres } from '../terrain/climb.ts';
  import RadioLinkCheck from '../terrain/RadioLinkCheck.svelte';
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
    /**
     * The base map shown: on the topographic and tactical maps, the light there (ADR-0157); on the
     * tactical map, whether a radio reaches it (ADR-0159).
     */
    base?: BaseMap | null;
  }

  let { t, locale, at, profile = true, base = null }: Props = $props();

  const light = $derived(base === 'topo' || base === 'tactical');
  const radio = $derived(base === 'tactical');

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
    () => (deviceLocation.fix ? [deviceLocation.fix.at, at] : null),
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
      bearing: formatBearing(leg.bearing, locale, bearings.style),
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
{#if profile}
  <WalkLight
    {t}
    {locale}
    {at}
    metres={leg?.metres ?? null}
    climb={leg ? (way.current?.climb ?? null) : null}
    {light}
  />
  {#if radio && terrain.onDemand}
    <RadioLinkCheck
      {t}
      {locale}
      from={deviceLocation.fix?.at ?? null}
      to={at}
      heights={terrain.onDemand}
    />
  {/if}
{/if}

<style>
  .from-here {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
