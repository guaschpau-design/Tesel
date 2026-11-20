<!-- What a military map prints in its margin, on the tactical map (ADR-0145): the MGRS zone and
     100 km square of the map's centre, "31T DG", and the magnetic declination there, "Decl. 1,4° E",
     under the scale with the map's other instruments; and the light there, when the sun sets or
     rises next and how much of the moon is lit, which opens «Luz de hoy» (ADR-0157). They follow
     the map as it moves. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { toMgrs } from '../coordinates/mgrs.ts';
  import { toUtm } from '../coordinates/utm.ts';
  import { nextLight } from '../daylight/arrival.ts';
  import { moonLight } from '../daylight/sky.ts';
  import { formatClock } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { bearings } from '../navigation/bearings.svelte.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
  }

  let { t, locale, map }: Props = $props();

  let square = $state('');
  let centre: LatLon | null = $state.raw(null);
  const clock = clockEvery(60_000);
  /** What is drawn below, moved into the element MapLibre places among its controls. */
  let content: HTMLDivElement;

  const declination = $derived.by(() => {
    const value = bearings.declination;
    if (value === null) return '';
    const side = value >= 0 ? 'E' : locale === 'es' ? 'O' : 'W';
    const degrees = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
    return t('declination', { value: `${degrees}° ${side}` });
  });

  /** The next change of the light at the centre, and the moon tonight. */
  const light = $derived.by(() => {
    if (centre === null) return null;
    const now = clock.seconds * 1000;
    const next = nextLight(centre, now);
    if (next.kind === 'none') return null;
    const sets = next.kind === 'sets';
    const time = formatClock(sets ? next.sunset : next.sunrise, locale);
    const percent = Math.round(moonLight(now).lit * 100);
    return {
      sets,
      time,
      percent,
      label: t(sets ? 'lightMarginSets' : 'lightMarginRises', { time, percent }),
    };
  });

  function update(): void {
    const { lat, lng } = map.getCenter();
    centre = { lat, lon: lng };
    const utm = toUtm(centre);
    if (utm === null) {
      square = '';
      return;
    }
    const mgrs = toMgrs(utm, 0);
    square = `${String(mgrs.zone)}${mgrs.band} ${mgrs.square}`;
  }

  onMount(() => {
    const element = document.createElement('div');
    element.className = 'maplibregl-ctrl';
    element.append(content);
    // Added after the scale, so MapLibre puts it below it.
    const control = {
      onAdd: () => element,
      onRemove: () => {
        element.remove();
      },
    };
    map.addControl(control, 'top-right');
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
      map.removeControl(control);
    };
  });
</script>

<div class="margin" bind:this={content}>
  {#if square !== ''}<strong>{square}</strong>{/if}
  {#if declination !== ''}<span>{declination}</span>{/if}
  {#if light && centre}
    {@const at = centre}
    <button
      class="light"
      aria-label={light.label}
      title={light.label}
      onclick={() => {
        openPanel({ name: 'light', at });
      }}
    >
      <Pictogram name="sun" size={14} />
      {light.sets ? '↓' : '↑'}&nbsp;{light.time} · <Pictogram name="moon" size={13} />
      {light.percent}&nbsp;%
    </button>
  {/if}
</div>

<style>
  /* In the map's own colours, as the scale above it: no box, a halo to read it over the map. */
  .margin {
    display: grid;
    justify-items: end;
    color: var(--map-text);
    font-size: var(--text-small);
    line-height: 1.25;
    text-shadow:
      0 0 2px var(--map-halo),
      0 0 2px var(--map-halo);
  }

  strong {
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  /* Read as the lines above it, and tapped: the map's controls take taps. */
  .light {
    display: inline-flex;
    gap: 0.2rem;
    align-items: center;
    min-height: 0;
    padding: 0.1rem 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-shadow: inherit;
    cursor: pointer;
  }
</style>
