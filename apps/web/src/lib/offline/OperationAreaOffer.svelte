<!-- Offers each member the map of the operation area, so it works there without a connection: a
     card on the map while an operation area is not downloaded yet, with its size, one button to
     download it and one to leave it for later. A download of it that stopped short is resumed,
     not started again; while any download runs, its own card follows it (DownloadCard). -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import { formatBytes } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { containsBounds } from '../map/tiles/math.ts';
  import { BASEMAP_MAX_ZOOM } from '../map/tiles/sources.ts';
  import type { OfflineArea } from '../map/tiles/store-schema.ts';
  import { operationAreas } from '../objects/operation-areas.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { offlineDownload as job } from './download-job.svelte.ts';
  import {
    detailThatFits,
    downloadLayers,
    areaLayers,
    estimatedBytes,
    failureText,
    isDownloaded,
    type OfflineMaps,
  } from './offline-maps.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    offline: OfflineMaps;
  }

  let { t, locale, groupState, offline }: Props = $props();

  /** The least detail worth offering: below a town's streets, the map is of little use on foot. */
  const LOWEST_DETAIL = BASEMAP_MAX_ZOOM - 2;

  let downloaded: readonly OfflineArea[] | null = $state.raw(null);
  /** Areas left for later on this device, until the app restarts. */
  const later = new SvelteSet<string>();

  /** The first operation area still to offer, with what downloading it takes. */
  const offer = $derived.by(() => {
    if (downloaded === null || job.running) return null;
    const areas = downloaded;
    const area = operationAreas(groupState).find(
      (candidate) => !later.has(candidate.key) && !isDownloaded(areas, candidate.bounds),
    );
    if (area === undefined) return null;
    // One that stopped short is finished, keeping what it has.
    const unfinished = areas.find(
      (stored) => !stored.complete && containsBounds(stored.bounds, area.bounds),
    );
    if (unfinished) {
      const layers = areaLayers(offline.archives, unfinished);
      return { area, layers, resumes: unfinished, bytes: estimatedBytes(area.bounds, layers) };
    }
    const zoom = detailThatFits(area.bounds, LOWEST_DETAIL);
    const layers = zoom === null ? null : downloadLayers(offline.archives, zoom, []);
    return {
      area,
      layers,
      resumes: undefined,
      bytes: layers ? estimatedBytes(area.bounds, layers) : 0,
    };
  });

  async function refresh(): Promise<void> {
    downloaded = await offline.store.listAreas();
  }

  function download(): void {
    if (offer?.layers == null) return;
    const { area, layers, resumes } = offer;
    const name = resumes?.name ?? (area.label || t('styleOperationArea'));
    attempt(
      () =>
        job.run(offline.store, {
          name,
          bounds: area.bounds,
          layers,
          ...(resumes ? { resumes } : {}),
        }),
      t('actionFailed'),
    );
  }

  // What is downloaded, read again whenever a download ends, here or in the panel.
  $effect(() => {
    if (job.running) return;
    untrack(() => {
      attempt(refresh, t('actionFailed'));
    });
  });
</script>

{#if offer}
  {@const { area, layers, bytes } = offer}
  {@const title = area.label
    ? t('operationAreaTitle', { name: area.label })
    : t('styleOperationArea')}
  <MapCard label={title}>
    <strong>{title}</strong>
    {#if layers === null}
      <p class="hint">{t('operationAreaTooLarge')}</p>
      <div class="row">
        <button onclick={() => later.add(area.key)}>{t('close')}</button>
      </div>
    {:else}
      <p class="hint">{t('operationAreaOffer', { size: formatBytes(bytes, locale) })}</p>
      {#if job.failure}<p class="warning">{failureText(job.failure, t, locale)}</p>{/if}
      <div class="row">
        <button class="primary" onclick={download}>{t('download')}</button>
        <button onclick={() => later.add(area.key)}>{t('notNow')}</button>
      </div>
    {/if}
  </MapCard>
{/if}
