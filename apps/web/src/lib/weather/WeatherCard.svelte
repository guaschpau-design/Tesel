<!-- The official weather warnings where this device is, on top of the map while the GPS knows
     where that is. A warning not seen yet shows in full; closing it leaves one line in its place,
     the highest warning and until when, which opens it again. So the map stays clear to work on
     without forgetting what is in force there (ADR-0100). -->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import WarningList from './WarningList.svelte';
  import type { WeatherFeed } from './weather-feed.svelte.ts';
  import { WARNING_LOOKS, warningsAt, warningText } from './weather-warnings.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    weather: WeatherFeed;
  }

  let { t, locale, weather }: Props = $props();

  /** Warnings closed on this device, by what tells one apart. */
  const seen = new SvelteSet<string>();
  /** Opened again from its line. */
  let reopened = $state(false);
  const here = $derived(
    deviceLocation.fix ? warningsAt(weather.regions, deviceLocation.fix.at) : null,
  );
  const keys = $derived(here?.warnings.map((w) => `${w.level}:${w.onset}:${w.expires}`) ?? []);
  const open = $derived(reopened || keys.some((key) => !seen.has(key)));

  const time = (seconds: number) => formatTime(seconds * 1000, locale);
</script>

{#if here?.warnings[0]}
  <!-- The highest level here, first in the list, colours the edge. -->
  {@const first = here.warnings[0]}
  {@const look = WARNING_LOOKS[first.level]}
  {#if open}
    <MapCard label={t('weatherHere')} edge="var(--tone-{look.tone})">
      <strong>{t('weatherHere')}</strong>
      <WarningList {t} {locale} {here} source={weather.source} />
      <div class="row">
        <button
          onclick={() => {
            for (const key of keys) seen.add(key);
            reopened = false;
          }}>{t('close')}</button
        >
      </div>
    </MapCard>
  {:else}
    {@const event = warningText(first, locale)?.event}
    {@const others = here.warnings.length - 1}
    <button
      class="brief"
      style:--edge="var(--tone-{look.tone})"
      aria-expanded="false"
      onclick={() => {
        reopened = true;
      }}
    >
      <Pictogram name="warning" />
      <span>
        {t(look.label)}{event ? ` · ${event}` : ''} · {first.onset * 1000 > Date.now()
          ? t('warningFromBrief', { from: time(first.onset) })
          : t('warningUntilBrief', { until: time(first.expires) })}{others > 0
          ? ` · +${String(others)}`
          : ''}
      </span>
    </button>
  {/if}
{/if}

<style>
  /* One line at the top of the map, as wide as what it says. */
  .brief {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    justify-self: start;
    max-width: 100%;
    min-height: var(--control-size);
    padding: 0 0.75rem;
    color: var(--fg);
    font-size: var(--text-secondary);
    pointer-events: auto;
    background: var(--surface);
    border: 0;
    border-left: 6px solid var(--edge);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-float);
  }

  .brief :global(svg) {
    color: var(--edge);
  }

  .brief span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
