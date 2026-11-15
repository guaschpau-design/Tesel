<!-- The report of an operation, at the foot of the diary, for anyone in the group (ADR-0118,
     ADR-0134): one button that downloads it as a PDF, for the group's last spell of activity, and
     under it those hours, with a way to choose others. -->
<script lang="ts">
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import { downloadFile } from '../ui/download.ts';
  import { gatherDebrief } from './debrief-data.ts';
  import { debriefPdf } from './debrief-pdf.ts';
  import { fieldValue, lastActivity, linesIn, periodOf } from './debrief.ts';
  import type { DiaryLine } from './diary.ts';
  import { fileName } from './file-name.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    format: Preference<CoordinateFormat>;
    /** The diary's lines, oldest first. */
    lines: readonly DiaryLine[];
  }

  let { t, locale, feed, format, lines }: Props = $props();

  /** Set once the user chooses the hours; until then they follow the group's last activity. */
  let chosen = $state<{ from: string; until: string } | null>(null);
  let choosing = $state(false);

  const last = $derived(lastActivity(lines));
  const from = $derived(chosen?.from ?? (last ? fieldValue(last.from) : ''));
  const until = $derived(chosen?.until ?? (last ? fieldValue(last.until) : ''));
  const period = $derived(periodOf(from, until));
  const inPeriod = $derived(period === null ? [] : linesIn(lines, period));

  function choose(): void {
    chosen = { from, until };
    choosing = !choosing;
  }

  function download(): void {
    if (period === null) return;
    const now = Date.now();
    const pdf = debriefPdf({
      group: feed.groupName,
      debrief: gatherDebrief(feed.state, lines, period),
      format: format.value,
      locale,
      t,
      now,
    });
    downloadFile(fileName(feed.groupName, now, 'pdf'), pdf, 'application/pdf');
  }
</script>

<div class="report">
  <ActionButton
    icon="download"
    label={t('debriefDownload')}
    disabled={inPeriod.length === 0}
    onclick={download}
  />
  {#if period}
    <p class="hours">
      {t('debriefHours', {
        from: formatTime(period.from, locale),
        until: formatTime(period.until, locale),
      })}
      ·
      <button class="link" aria-expanded={choosing} onclick={choose}
        >{t('debriefChangeHours')}</button
      >
    </p>
  {/if}
  {#if choosing && chosen}
    {@const hours = chosen}
    <div class="row when">
      <label>
        {t('debriefFrom')}
        <input type="datetime-local" bind:value={hours.from} />
      </label>
      <label>
        {t('debriefUntil')}
        <input type="datetime-local" bind:value={hours.until} />
      </label>
    </div>
    <p class="hint" role="status">
      {inPeriod.length === 0
        ? t('debriefNothing')
        : t('debriefEntries', { count: inPeriod.length })}
    </p>
  {/if}
</div>

<style>
  .report {
    display: grid;
    flex: none;
    gap: 0.4rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  /* The one button, across the panel. */
  .report > :global(button) {
    justify-content: center;
    width: 100%;
  }

  .link {
    min-height: 0;
    padding: 0;
    color: var(--link);
    font: inherit;
    text-decoration: underline;
    background: none;
    border: none;
  }

  .hours {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-small);
    text-align: center;
  }

  .when > label {
    flex: 1 1 10rem;
  }
</style>
