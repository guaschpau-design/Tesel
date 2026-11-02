<!-- Follows the download of an offline map while its panel is closed: a card on the map with its
     name, how far it is and a button to cancel it; when it ends, a notice says whether the map
     was saved or why not. -->
<script lang="ts">
  import { untrack } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { isOpen } from '../ui/panels.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { notices } from '../ui/notices.svelte.ts';
  import { offlineDownload as job } from './download-job.svelte.ts';
  import { failureText } from './offline-maps.ts';

  interface Props {
    t: Translate;
    locale: Locale;
  }

  let { t, locale }: Props = $props();

  // How a download that ran while the panel was closed ended. Cancelling it needs no word.
  let wasRunning = untrack(() => job.running);
  $effect(() => {
    const running = job.running;
    if (wasRunning && !running && !untrack(() => isOpen('offline'))) {
      untrack(() => {
        if (job.failure !== null) notices.show(failureText(job.failure, t, locale));
        else if (!job.cancelled) notices.show(t('offlineSaved', { name: job.name }));
      });
    }
    wasRunning = running;
  });
</script>

{#if job.progress && !isOpen('offline')}
  <MapCard label={t('offlineAreas')}>
    <strong>{job.name}</strong>
    <progress max={job.progress.total} value={job.progress.done}></progress>
    <div class="row">
      <span class="hint">
        {t('downloading', { done: job.progress.done, total: job.progress.total })}
      </span>
      <button
        onclick={() => {
          job.cancel();
        }}>{t('cancel')}</button
      >
    </div>
  </MapCard>
{/if}

<style>
  progress {
    width: 100%;
  }

  .row {
    justify-content: space-between;
    align-items: center;
  }
</style>
