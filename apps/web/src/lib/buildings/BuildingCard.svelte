<!-- In the panel of a building tapped on the urban map (ADR-0158, ADR-0161): its floors and how
     high it is, what it is used for, the ground it covers, its house numbers and where its outline
     comes from, as far as the map knows them. -->
<script lang="ts">
  import { formatArea } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { BuildingFacts, BuildingKind, OutlineSource } from './building.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    building: BuildingFacts;
  }

  let { t, locale, building }: Props = $props();

  const KINDS: Readonly<Record<BuildingKind, MessageKey>> = {
    homes: 'buildingKindHomes',
    industry: 'buildingKindIndustry',
    commerce: 'buildingKindCommerce',
    education: 'buildingKindEducation',
    health: 'buildingKindHealth',
    worship: 'buildingKindWorship',
    garage: 'buildingKindGarage',
    farm: 'buildingKindFarm',
    public: 'buildingKindPublic',
  };

  const height = $derived.by(() => {
    const { floors, height } = building;
    if (floors === null) return null;
    if (!floors.known) return t('buildingFloors', { count: floors.count, height: height ?? 0 });
    return height === null
      ? t('buildingFloorsKnown', { count: floors.count })
      : t('buildingFloorsKnownHeight', { count: floors.count, height });
  });

  function outline(source: OutlineSource): string {
    switch (source.kind) {
      case 'osm':
        return t('buildingOutlineOsm');
      case 'national':
        return t('buildingOutlineNational');
      case 'imagery':
        return t('buildingOutlineImagery');
      case 'other':
        return source.name;
    }
  }

  const join = $derived(
    new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(building.numbers),
  );
</script>

{#if height !== null}
  <p class="line"><strong>{t('buildingHeight')}</strong> {height}</p>
{:else}
  <p class="note">{t('buildingNoHeight')}</p>
{/if}
{#if building.kind !== null}
  <p class="line"><strong>{t('buildingUse')}</strong> {t(KINDS[building.kind])}</p>
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
{#if building.source !== null}
  <p class="line">
    <strong>{t('buildingOutline')}</strong>
    {outline(building.source)}
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
