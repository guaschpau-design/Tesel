<!-- The active group's backup copy, folded in the groups panel (ADR-0134): its log, encrypted, to
     save as a file and load on another device, where only what is missing is added. -->
<script lang="ts">
  import { fileName } from '../diary/file-name.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import type { LogImport } from '../sync/log-file.ts';
  import { downloadFile } from '../ui/download.ts';
  import Fold from '../ui/Fold.svelte';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    feed: GroupFeed;
  }

  let { t, feed }: Props = $props();

  let loaded: LogImport | null = $state(null);
  let picker: HTMLInputElement | undefined = $state();

  const OUTCOMES: Readonly<Record<Exclude<LogImport['kind'], 'loaded'>, MessageKey>> = {
    'other-group': 'logOtherGroup',
    unreadable: 'logUnreadable',
  };

  function saveLog(): void {
    const name = fileName(feed.groupName, Date.now(), 'tesel');
    attempt(async () => {
      downloadFile(name, await feed.exportLog(), 'application/json');
    }, t('actionFailed'));
  }

  function loadLog(event: Event & { currentTarget: HTMLInputElement }): void {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    attempt(async () => {
      try {
        loaded = await feed.importLog(await file.text());
      } finally {
        input.value = '';
      }
    }, t('actionFailed'));
  }
</script>

<Fold title={t('logTitle')} summary={t('logSummary')}>
  <div class="row">
    <button onclick={saveLog}>{t('logSave')}</button>
    <button onclick={() => picker?.click()}>{t('logLoad')}</button>
    <input
      bind:this={picker}
      type="file"
      accept=".tesel,application/json"
      hidden
      onchange={loadLog}
    />
  </div>
  {#if loaded?.kind === 'loaded'}
    <p role="status">{t('logLoaded', { count: loaded.added, total: loaded.total })}</p>
  {:else if loaded}
    <p class="warning" role="status">{t(OUTCOMES[loaded.kind])}</p>
  {/if}
</Fold>
