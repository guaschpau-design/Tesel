<!-- The operation diary (ADR-0134): what has happened in the group, by day with the newest first,
     each line with its time, the app's sign for what it tells and who did it; a call for help
     stands out in red. At its foot, the report of the operation as a PDF. -->
<script lang="ts">
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { diaryDays, isCall, LINE_SIGNS } from './diary-days.ts';
  import { diaryLines } from './diary.ts';
  import DiaryReport from './DiaryReport.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    format: Preference<CoordinateFormat>;
    onclose: () => void;
  }

  let { t, locale, feed, format, onclose }: Props = $props();

  /** "Hoy" becomes "Ayer" at midnight with the panel open. */
  const now = clockEvery(60_000);
  const lines = $derived(diaryLines(feed.state, t));
  const days = $derived(diaryDays(lines, { t, locale, now: now.seconds * 1000 }));

  function timeOf(seconds: number): string {
    return new Date(seconds * 1000).toLocaleTimeString(locale, { timeStyle: 'short' });
  }
</script>

<Panel title={t('diary')} closeLabel={t('close')} {onclose} fill>
  <div class="scroll">
    {#each days as day (day.key)}
      <section class="day">
        <h3>{day.name}</h3>
        <ol>
          {#each day.lines as line (line.key)}
            <li class:call={isCall(line)}>
              <span class="time">{timeOf(line.time)}</span>
              <Pictogram name={LINE_SIGNS[line.type]} size={18} />
              <span class="what">
                <span class="who">{line.author}</span>
                {line.text}
              </span>
            </li>
          {/each}
        </ol>
      </section>
    {:else}
      <p class="hint">{t('diaryEmpty')}</p>
    {/each}
  </div>
  <DiaryReport {t} {locale} {feed} {format} {lines} />
</Panel>

<style>
  /* The days take the height left by the report at the foot, and scroll. */
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .day + .day {
    margin-top: 0.9rem;
  }

  h3 {
    margin: 0 0 0.15rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* The time, the sign and what happened, in three columns. */
  li {
    display: grid;
    grid-template-columns: 3rem 1.1rem minmax(0, 1fr);
    gap: 0.6rem;
    align-items: start;
    padding: 0.55rem 0;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }

  li:last-child {
    border-bottom: none;
  }

  .time {
    font-size: var(--text-small);
    font-variant-numeric: tabular-nums;
    line-height: 1.45rem;
  }

  .what {
    display: grid;
    color: var(--fg);
    overflow-wrap: anywhere;
  }

  .who {
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
  }

  /* A call for help, in red: the line that must not be missed. */
  li.call {
    margin: 0.15rem -0.4rem;
    padding-inline: 0.4rem;
    color: var(--danger);
    font-weight: 600;
    background: var(--danger-tint);
    border-bottom: none;
    border-radius: var(--radius-card);
  }

  li.call .what,
  li.call .who {
    color: var(--danger);
  }
</style>
