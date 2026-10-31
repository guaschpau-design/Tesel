<!-- The maps downloaded for use without a connection: downloading the visible area, its size and
     the button first, and folded under "Options" its name, its detail and, if wanted, the
     topographic map, the satellite map and the relief; then the list of areas, to show or delete
     them. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { formatBytes, formatDateTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { countAreaTiles, MAX_AREA_TILES } from '../map/tiles/area-download.ts';
  import { mapBounds } from '../map/geometry.ts';
  import { BASEMAP_MAX_ZOOM } from '../map/tiles/sources.ts';
  import type { Bounds } from '../map/tiles/math.ts';
  import type { OfflineArea } from '../map/tiles/store-schema.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import Panel from '../ui/Panel.svelte';
  import { DownloadJob } from './download-job.svelte.ts';
  import {
    areaContents,
    areaLayers,
    downloadLayers,
    estimatedBytes,
    EXTRA_NAMES,
    EXTRAS,
    failureText,
    type Extra,
    type OfflineMaps,
  } from './offline-maps.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    offline: OfflineMaps;
    onclose: () => void;
  }

  let { t, locale, map, offline, onclose }: Props = $props();

  const detailOptions = [
    { zoom: BASEMAP_MAX_ZOOM, label: 'detailStreets' },
    { zoom: BASEMAP_MAX_ZOOM - 1, label: 'detailTown' },
    { zoom: BASEMAP_MAX_ZOOM - 2, label: 'detailRegion' },
  ] as const;

  // Raw state: these values are stored in IndexedDB again (a download, a resumed one), which
  // cannot clone Svelte's reactive proxies.
  let areas: readonly OfflineArea[] = $state.raw([]);
  // The view as the panel opens; each move of the map updates it.
  let bounds: Bounds = $state.raw(untrack(() => mapBounds(map)));
  let maxZoom: number = $state(BASEMAP_MAX_ZOOM);
  let name = $state('');
  let storage: { used: number; quota: number } | null = $state(null);
  let extras: Extra[] = $state([]);
  const job = new DownloadJob();

  const layers = $derived(downloadLayers(offline.archives, maxZoom, extras));
  const tileCount = $derived(countAreaTiles(bounds, layers));
  const bytes = $derived(estimatedBytes(bounds, layers));
  const tooLarge = $derived(tileCount > MAX_AREA_TILES);
  const detailLabel = $derived(
    detailOptions.find((option) => option.zoom === maxZoom)?.label ?? 'detailStreets',
  );

  async function refresh(): Promise<void> {
    areas = await offline.store.listAreas();
    const estimate = await navigator.storage.estimate();
    storage = { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  }

  function startDownload(): void {
    const areaName =
      name.trim() || t('defaultAreaName', { date: formatDateTime(Date.now(), locale) });
    attempt(async () => {
      if (await job.run(offline.store, { name: areaName, bounds, layers })) name = '';
      await refresh();
    }, t('actionFailed'));
  }

  /** Downloads what an incomplete area is missing, skipping the tiles it has (ADR-0056). */
  function resume(area: OfflineArea): void {
    const plan = {
      name: area.name,
      bounds: area.bounds,
      layers: areaLayers(offline.archives, area),
      resumes: area,
    };
    attempt(async () => {
      await job.run(offline.store, plan);
      await refresh();
    }, t('actionFailed'));
  }

  async function remove(area: OfflineArea): Promise<void> {
    const text = t('confirmDelete', { name: area.name });
    if (!(await confirmations.ask({ text, confirm: t('delete') }))) return;
    attempt(async () => {
      await offline.store.deleteArea(area);
      await refresh();
    }, t('actionFailed'));
  }

  function show(area: OfflineArea): void {
    const { west, south, east, north } = area.bounds;
    map.fitBounds([west, south, east, north], { padding: 24 });
  }

  onMount(() => {
    const update = () => (bounds = mapBounds(map));
    map.on('moveend', update);
    attempt(refresh, t('actionFailed'));
    return () => {
      map.off('moveend', update);
      job.cancel();
    };
  });
</script>

<Panel title={t('offlineAreas')} closeLabel={t('close')} {onclose}>
  <p class="intro">{t('areasIntro')}</p>

  <form
    class="download"
    onsubmit={(event) => {
      event.preventDefault();
      startDownload();
    }}
  >
    <h3>{t('downloadVisible')}</h3>
    {#if job.progress}
      <progress max={job.progress.total} value={job.progress.done}></progress>
      <p class="hint">
        {t('downloading', { done: job.progress.done, total: job.progress.total })}
      </p>
      <button
        type="button"
        onclick={() => {
          job.cancel();
        }}>{t('cancel')}</button
      >
    {:else if tooLarge}
      <p class="warning">{t('areaTooLarge')}</p>
    {:else}
      <div class="go">
        <button type="submit" class="primary">{t('download')}</button>
        <span class="hint">{t('estimate', { size: formatBytes(bytes, locale) })}</span>
      </div>
    {/if}
    {#if job.failure}<p class="warning">{failureText(job.failure, t, locale)}</p>{/if}
    <Fold title={t('downloadOptions')} summary={t(detailLabel)}>
      <label>
        {t('areaName')}
        <input bind:value={name} maxlength="40" disabled={job.running} />
      </label>
      <label>
        {t('detail')}
        <select bind:value={maxZoom} disabled={job.running}>
          {#each detailOptions as option (option.zoom)}
            <option value={option.zoom}>{t(option.label)}</option>
          {/each}
        </select>
      </label>
      <fieldset class="extras" disabled={job.running}>
        <legend>{t('downloadAlso')}</legend>
        {#each EXTRAS as extra (extra)}
          <label class="check">
            <input type="checkbox" value={extra} bind:group={extras} />
            {t(EXTRA_NAMES[extra])}
          </label>
        {/each}
        <p class="hint">{t('downloadAlsoHint')}</p>
      </fieldset>
    </Fold>
  </form>

  {#if areas.length === 0}
    <p class="hint">{t('noAreas')}</p>
  {:else}
    <ul class="cards areas">
      {#each areas as area (area.id)}
        <li>
          <div>
            <strong>{area.name}</strong>
            {#if !area.complete}<span class="badge danger">{t('incomplete')}</span>{/if}
            <span class="hint">
              {areaContents(area)
                .map((key) => t(key))
                .join(' + ')} ·
              {formatBytes(area.bytes, locale)} · {formatDateTime(area.createdAt, locale)}
            </span>
          </div>
          <div class="row">
            {#if !area.complete}
              <button
                disabled={job.running}
                onclick={() => {
                  resume(area);
                }}>{t('resume')}</button
              >
            {/if}
            <button
              onclick={() => {
                show(area);
              }}>{t('showOnMap')}</button
            >
            <button
              disabled={job.running}
              onclick={() => {
                void remove(area);
              }}>{t('delete')}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if storage}
    <p class="hint">
      {t('storageUsed', {
        used: formatBytes(storage.used, locale),
        quota: formatBytes(storage.quota, locale),
      })}
    </p>
  {/if}
</Panel>

<style>
  .download {
    display: grid;
    gap: 0.6rem;
    margin: 1rem 0;
    padding: 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  progress {
    width: 100%;
  }

  .go {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }

  .extras {
    display: grid;
    gap: 0.35rem;
  }

  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .areas li .hint {
    display: block;
  }
</style>
