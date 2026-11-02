<!-- The active group's chat, with situation reports in the same timeline, and the reports pinned
     in a tab of their own, which also leads to writing a new one. It fills the panel, so as many
     lines as possible are in view, and writes in one row. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { eventRefKey, type NodeId, type Place } from '@tesel/protocol';
  import { onDestroy, tick } from 'svelte';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import type { StoredRadioText } from '../radio/radio-texts.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import ReportCard from '../reports/ReportCard.svelte';
  import { addedUp, casualtiesLine } from '../reports/report-summary.ts';
  import ChatComposer from './ChatComposer.svelte';
  import ChatLine from './ChatLine.svelte';
  import ChatTabs from './ChatTabs.svelte';
  import { ChatDraft } from './chat-draft.svelte.ts';
  import type { ChatTab } from './chat-tabs.ts';
  import { speechRecognizer } from './dictation.svelte.ts';
  import { timeline } from './timeline.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Own events that have reached no one yet, by event reference key: shown as pending. */
    undelivered: ReadonlySet<string>;
    onsend: (text: string) => Promise<void>;
    /** Opens the form of a new report. */
    onnewreport: () => void;
    /** Shows a report's place on the map. */
    onplace: (place: Place) => void;
    /** The tab shown, and how another one is shown. */
    tab: ChatTab;
    ontab: (tab: ChatTab) => void;
    /** Text messages of other MeshCore apps heard by the radio; shown in their own tab. */
    radioTexts: readonly StoredRadioText[];
    showRadioTab: boolean;
    onclose: () => void;
  }

  let {
    t,
    locale,
    groupState,
    self,
    undelivered,
    onsend,
    onnewreport,
    onplace,
    tab,
    ontab,
    radioTexts,
    showRadioTab,
    onclose,
  }: Props = $props();

  /** Newest first. */
  const reports = $derived([...groupState.reports].reverse());
  const casualtiesTotal = $derived(casualtiesLine(addedUp(groupState.reports), t));

  /** Where a text of another MeshCore app was heard, and who sent it if it says. */
  function heardIn(message: StoredRadioText): string {
    const where =
      message.kind === 'direct'
        ? t('meshcoreDirect')
        : t('meshcoreChannel', { name: message.channel ?? t('meshcoreUnknownChannel') });
    return message.sender ? `${where} · ${message.sender}` : where;
  }

  const draft = new ChatDraft(speechRecognizer());
  onDestroy(() => draft.dictation?.cancel());

  let list: HTMLOListElement | undefined = $state();
  const entries = $derived(timeline(groupState));

  /** How near the end, in pixels, the reader still counts as at the end. */
  const END_SLACK_PX = 48;
  const newestKey = $derived(entries.at(-1)?.key);
  const newestOwn = $derived(entries.at(-1)?.event.origin === self);
  /** Whether the reader is at the newest entry, not reading older ones. */
  let atEnd = true;
  /** The list last scrolled: one shown again, after another tab, opens at the newest entry. */
  let scrolled: HTMLOListElement | undefined;

  // A new entry is shown if the reader was at the end or wrote it; anything else that changes in
  // the group leaves the reader where they are.
  $effect(() => {
    const element = list;
    if (element === undefined || newestKey === undefined) return;
    if (element === scrolled && !atEnd && !newestOwn) return;
    scrolled = element;
    void tick().then(() => element.lastElementChild?.scrollIntoView({ block: 'end' }));
  });

  function onscroll(): void {
    if (list === undefined) return;
    atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < END_SLACK_PX;
  }
</script>

<Panel title={t('chat')} closeLabel={t('close')} {onclose} fill>
  {#snippet header()}
    <ChatTabs
      {t}
      {tab}
      {ontab}
      {showRadioTab}
      reportCount={reports.length}
      radioTextCount={radioTexts.length}
    />
  {/snippet}

  <div id="chat-tabpanel" class="tabpanel" role="tabpanel" aria-labelledby="chat-tab-{tab}">
    {#if tab === 'reports'}
      <div class="scroll stack">
        {#if reports.length === 0}
          <p class="hint">{t('reportsNone')}</p>
        {:else}
          {#if casualtiesTotal}
            <p class="hint">{t('reportsTotal', { casualties: casualtiesTotal })}</p>
          {/if}
          <ol class="reports">
            {#each reports as report (eventRefKey(report))}
              <li><ReportCard {t} {locale} {groupState} {report} open {onplace} /></li>
            {/each}
          </ol>
        {/if}
      </div>
      <button class="primary new-report" onclick={onnewreport}>
        <Pictogram name="pushpin" size={18} />
        {t('reportNew')}
      </button>
    {:else if tab === 'meshcore' && showRadioTab}
      <div class="scroll stack">
        <p class="hint">{t('meshcoreIntro')}</p>
        {#if radioTexts.length === 0}
          <p class="hint">{t('noMeshcoreMessages')}</p>
        {:else}
          <ol class="messages">
            {#each radioTexts as message, index (index)}
              <ChatLine
                text={message.text}
                time={formatTime(message.receivedAt, locale)}
                meta={heardIn(message)}
              />
            {/each}
          </ol>
        {/if}
      </div>
    {:else}
      {#if entries.length === 0}
        <p class="hint scroll">{t('noMessages')}</p>
      {:else}
        <ol class="messages scroll" bind:this={list} {onscroll}>
          {#each entries as entry (entry.key)}
            {#if entry.kind === 'report'}
              <!-- A report is its own card, across the panel, not a line. -->
              <li>
                <ReportCard {t} {locale} {groupState} report={entry.event} open={false} {onplace} />
              </li>
            {:else}
              {@const own = entry.event.origin === self}
              <ChatLine
                text={entry.event.text}
                time={formatTime(entry.event.time * 1000, locale)}
                meta={own || entry.follows ? undefined : aliasOf(groupState, entry.event.origin)}
                {own}
                follows={entry.follows}
                pending={undelivered.has(eventRefKey(entry.event)) ? t('notSentYet') : undefined}
              />
            {/if}
          {/each}
        </ol>
      {/if}

      <ChatComposer {t} {locale} {draft} {onsend} />
    {/if}
  </div>
</Panel>

<style>
  /* The tab's content lays out in the panel as if there were no wrapper. */
  .tabpanel {
    display: contents;
  }

  /* What scrolls takes the height left by the tabs and the row that writes. */
  .scroll {
    flex: 1;
    align-content: start;
    min-height: 0;
    margin: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .new-report {
    display: inline-flex;
    flex: none;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
  }

  .reports {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .messages {
    display: grid;
    align-content: start;
    gap: 0.4rem;
    padding: 0;
    list-style: none;
  }
</style>
