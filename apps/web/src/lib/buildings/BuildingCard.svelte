<!-- In the panel of a building tapped on the urban map (ADR-0158): about how many floors and how
     high, the ground it covers and its house numbers, as far as the map knows them. -->
<script lang="ts">
  import { formatArea } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { BuildingFacts } from './building.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    building: BuildingFacts;
  }

  let { t, locale, building }: Props = $props();

  const join = $derived(
    new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(building.numbers),
  );
</script>

{#if building.height !== null && building.floors !== null}
  <p class="line">
    <strong>{t('buildingHeight')}</strong>
    {t('buildingFloors', { count: building.floors, height: building.height })}
  </p>
{:else}
  <p class="note">{t('buildingNoHeight')}</p>
{/if}
{#if building.footprint !== null || building.numbers.length > 0}
  <p class="line">
    {#if building.footprint !== null}
      <strong>{t('buildingFootprint')}</strong>
      {formatArea(building.footprint, locale)}
    {/if}
    {#if building.numbers.length > 0}
      <span class:aside={building.footprint !== null}
        >{t('buildingNumbers', { count: building.numbers.length, numbers: join })}</span
      >
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

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
