<!-- The debrief of an operation, for whoever coordinates (ADR-0118): two times, filled in on
     opening with the group's last spell of activity, and the report of what the diary holds
     between them, downloaded as a PDF. -->
<script lang="ts">
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import { downloadFile } from '../ui/download.ts';
  import Fold from '../ui/Fold.svelte';
  import type { DiaryLine } from './diary.ts';
  import { fileName } from './diary-text.ts';
  import { fieldValue, lastActivity, linesIn, periodOf, debriefSummary } from './debrief.ts';
  import { debriefPdf } from './debrief-pdf.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    format: Preference<CoordinateFormat>;
    /** The diary's lines, oldest first. */
    lines: readonly DiaryLine[];
  }

  let { t, locale, feed, format, lines }: Props = $props();

  let from = $state('');
  let until = $state('');
  const period = $derived(periodOf(from, until));
  const chosen = $derived(period === null ? [] : linesIn(lines, period));

  /** The group's last spell of activity, each time the fold is opened. */
  function fill(): void {
    const last = lastActivity(lines);
    const now = Date.now();
    from = fieldValue(last?.from ?? now);
    until = fieldValue(last?.until ?? now);
  }

  function download(): void {
    if (period === null) return;
    const now = Date.now();
    const pdf = debriefPdf({
      group: feed.groupName,
      period,
      summary: debriefSummary(feed.state, period),
      lines: chosen,
      format: format.value,
      locale,
      t,
      now,
    });
    downloadFile(fileName(feed.groupName, now, 'pdf'), pdf, 'application/pdf');
  }
</script>

<Fold title={t('debrief')} summary={t('debriefSummary')} onopen={fill}>
  <div class="row when">
    <label>
      {t('debriefFrom')}
      <input type="datetime-local" bind:value={from} />
    </label>
    <label>
      {t('debriefUntil')}
      <input type="datetime-local" bind:value={until} />
    </label>
  </div>
  <p class="hint" role="status">
    {chosen.length === 0 ? t('debriefNothing') : t('debriefEntries', { count: chosen.length })}
  </p>
  <div class="row">
    <ActionButton
      icon="download"
      label={t('debriefMake')}
      disabled={chosen.length === 0}
      onclick={download}
    />
  </div>
</Fold>

<style>
  .when > label {
    flex: 1 1 12rem;
  }
</style>
