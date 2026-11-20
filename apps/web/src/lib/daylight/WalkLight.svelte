<!-- Under how far a point is: how long the way there takes on foot, once its climb is known
     (ADR-0156), and, on the maps for the country, the light there: when the sun sets or rises, and
     a warning when arriving with little light or in the dark (ADR-0157). -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Climb } from '../terrain/climb.ts';
  import { roundedMinutes, walkDuration, walkingMinutes } from '../terrain/walking.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { arrivalLight, nextLight } from './arrival.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** Where the way goes. */
    at: LatLon;
    /** How long the way from here is, and how much it climbs and descends, once known. */
    metres: number | null;
    climb: Climb | null;
    /** Whether to tell the light there. */
    light: boolean;
  }

  let { t, locale, at, metres, climb, light }: Props = $props();

  const clock = clockEvery(60_000);
  const now = $derived(clock.seconds * 1000);
  const minutes = $derived(
    metres !== null && climb ? roundedMinutes(walkingMinutes(metres, climb)) : null,
  );
  const arrival = $derived(minutes === null ? null : now + minutes * 60_000);
  const next = $derived(light ? nextLight(at, now) : null);
  const onArrival = $derived(light && arrival !== null ? arrivalLight(at, now, arrival) : null);

  function time(at: number): string {
    return formatTime(at, locale, now);
  }
</script>

{#if minutes !== null && arrival !== null}
  <p class="line">
    <strong>{t('walkLabel')}</strong>
    {t('walkArrival', { duration: walkDuration(t, minutes), time: time(arrival) })}
  </p>
{/if}
{#if next && next.kind === 'sets'}
  <p class="line">
    <strong>{t('lightLabel')}</strong>
    {t('lightSets', { time: time(next.sunset) })}{#if next.dusk !== null}<span class="aside"
        >{t('lightDark', { time: time(next.dusk) })}</span
      >{/if}
  </p>
{:else if next && next.kind === 'rises'}
  <p class="line">
    <strong>{t('lightLabel')}</strong>
    {t('lightRises', { time: time(next.sunrise) })}
  </p>
{/if}
{#if onArrival?.kind === 'dim'}
  <p class="warning dim">{t('arrivalDim', { minutes: onArrival.minutes })}</p>
{:else if onArrival?.kind === 'night'}
  <p class="warning night">
    {#if onArrival.sunset !== null}
      {t('arrivalAfterSunset', { time: time(onArrival.sunset) })}
    {:else if onArrival.sunrise !== null}
      {t('arrivalBeforeSunrise', { time: time(onArrival.sunrise) })}
    {/if}
  </p>
{/if}

<style>
  .line {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
    align-items: baseline;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .aside {
    margin-inline-start: 0.5rem;
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  .warning {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--warning);
    border-radius: var(--radius-control);
  }

  .night {
    border-color: var(--danger);
    background: var(--danger-tint);
  }
</style>
