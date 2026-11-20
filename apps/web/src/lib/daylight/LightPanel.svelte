<!-- «Luz de hoy» (ADR-0157): at a place, the day's first and last light, sunrise and sunset, and
     the moon, how much of it is lit and when it rises and sets. Worked out on the device. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import { formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import Panel from '../ui/Panel.svelte';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { dayStart, lightOfDay, moonLight } from './sky.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    at: LatLon;
    onclose: () => void;
  }

  let { t, locale, at, onclose }: Props = $props();

  const clock = clockEvery(60_000);
  const now = $derived(clock.seconds * 1000);
  const midnight = $derived(dayStart(now));
  const light = $derived(lightOfDay(at, midnight));
  const moon = $derived(moonLight(now));

  function time(value: number | null): string {
    return value === null ? t('lightNone') : formatTime(value, locale, now);
  }

  const rows: readonly { label: MessageKey; value: number | null; hint?: MessageKey }[] = $derived([
    { label: 'lightDawn', value: light.dawn, hint: 'lightDawnHint' },
    { label: 'lightSunrise', value: light.sunrise },
    { label: 'lightSunset', value: light.sunset },
    { label: 'lightDusk', value: light.dusk, hint: 'lightDuskHint' },
  ]);
</script>

<Panel title={t('lightToday')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <dl>
      {#each rows as row (row.label)}
        <dt>{t(row.label)}</dt>
        <dd>
          <span class="time">{time(row.value)}</span>
          {#if row.hint}<span class="hint">{t(row.hint)}</span>{/if}
        </dd>
      {/each}
      <dt>{t('lightMoon')}</dt>
      <dd>
        <span class="time"
          >{t(moon.waxing ? 'moonWaxing' : 'moonWaning', {
            percent: Math.round(moon.lit * 100),
          })}</span
        >
        <span class="hint"
          >{t('moonRises', { time: time(light.moonrise) })} · {t('moonSets', {
            time: time(light.moonset),
          })}</span
        >
      </dd>
    </dl>
    <p class="about">{t('lightTodayAbout')}</p>
  </div>
</Panel>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0;
    margin: 0;
  }

  dt,
  dd {
    margin: 0;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--border);
  }

  dt {
    padding-inline-end: 1rem;
    font-weight: 700;
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.75rem;
    align-items: baseline;
  }

  .time {
    font-variant-numeric: tabular-nums;
  }

  .hint,
  .about {
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  .about {
    margin: 0;
  }
</style>
