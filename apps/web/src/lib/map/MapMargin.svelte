<!-- What a military map prints in its margin, on the tactical map (ADR-0145): the MGRS zone and
     100 km square of the map's centre, "31T DG", and the magnetic declination there, "Decl. 1,4° E",
     under the scale with the map's other instruments. They follow the map as it moves. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { toMgrs } from '../coordinates/mgrs.ts';
  import { toUtm } from '../coordinates/utm.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { bearings } from '../navigation/bearings.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
  }

  let { t, locale, map }: Props = $props();

  let square = $state('');
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

  function update(): void {
    const centre = map.getCenter();
    const utm = toUtm({ lat: centre.lat, lon: centre.lng });
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
</style>
