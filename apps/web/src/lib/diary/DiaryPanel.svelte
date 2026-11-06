<!-- The operation diary: everything that has happened in the group, newest first, to read and to
     download; for whoever coordinates, the debrief of some hours of it as a PDF; folded below it,
     the group's log to save or load on another device. -->
<script lang="ts">
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import type { LogImport } from '../sync/log-file.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import { downloadFile } from '../ui/download.ts';
  import Fold from '../ui/Fold.svelte';
  import Panel from '../ui/Panel.svelte';
  import { diaryLines } from './diary.ts';
  import { diaryText, fileName } from './diary-text.ts';
  import DebriefFold from './DebriefFold.svelte';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    format: Preference<CoordinateFormat>;
    /** Whoever coordinates the group makes its debriefs. */
    coordinator: boolean;
    onclose: () => void;
  }

  let { t, locale, feed, format, coordinator, onclose }: Props = $props();

  const lines = $derived(diaryLines(feed.state, t));
  const newestFirst = $derived([...lines].reverse());
  let loaded: LogImport | null = $state(null);
  let picker: HTMLInputElement | undefined = $state();

  const OUTCOMES: Readonly<Record<Exclude<LogImport['kind'], 'loaded'>, MessageKey>> = {
    'other-group': 'logOtherGroup',
    unreadable: 'logUnreadable',
  };

  function downloadDiary(): void {
    const now = Date.now();
    const text = diaryText(lines, { group: feed.groupName, format: format.value, locale, t, now });
    downloadFile(fileName(feed.groupName, now, 'txt'), text, 'text/plain;charset=utf-8');
  }

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

<Panel title={t('diary')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <div class="row">
      <ActionButton
        icon="download"
        label={t('diaryDownload')}
        disabled={lines.length === 0}
        onclick={downloadDiary}
      />
    </div>

    {#if coordinator}
      <DebriefFold {t} {locale} {feed} {format} {lines} />
    {/if}

    {#if newestFirst.length === 0}
      <p class="hint">{t('diaryEmpty')}</p>
    {:else}
      <ol class="diary">
        {#each newestFirst as line (line.key)}
          <li>
            <span class="hint">{formatTime(line.time * 1000, locale)} · {line.author}</span>
            <span>{line.text}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <div class="section">
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
  </div>
</Panel>

<style>
  .diary {
    display: grid;
    gap: 0.6rem;
    max-height: 45dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .diary li {
    display: grid;
    gap: 0.1rem;
  }

  .diary .hint {
    font-size: var(--text-small);
  }
</style>
