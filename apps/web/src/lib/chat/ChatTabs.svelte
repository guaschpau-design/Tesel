<!-- The chat panel's tabs, heading it beside its close button: the group's messages, its reports
     with how many there are, and the texts of other MeshCore apps while the radio has any to
     show. They control the panel's one tab panel (#chat-tabpanel). -->
<script lang="ts">
  import { tick } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import type { ChatTab } from './chat-tabs.ts';

  interface Props {
    t: Translate;
    /** The tab shown, and how another one is shown. */
    tab: ChatTab;
    ontab: (tab: ChatTab) => void;
    showRadioTab: boolean;
    reportCount: number;
    radioTextCount: number;
  }

  let { t, tab, ontab, showRadioTab, reportCount, radioTextCount }: Props = $props();

  const tabs: readonly ChatTab[] = $derived(
    showRadioTab ? ['group', 'reports', 'meshcore'] : ['group', 'reports'],
  );

  /** Arrow keys, Home and End move between the tabs, as in any tab list. */
  function moveTab(event: KeyboardEvent): void {
    const index = tabs.indexOf(tab);
    const to = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    const next = to === undefined ? undefined : tabs[to];
    if (next === undefined) return;
    event.preventDefault();
    ontab(next);
    void tick().then(() => document.getElementById(`chat-tab-${next}`)?.focus());
  }
</script>

<div class="tabs" role="tablist" tabindex="-1" onkeydown={moveTab}>
  {#each tabs as each (each)}
    <button
      role="tab"
      id="chat-tab-{each}"
      aria-selected={tab === each}
      aria-controls="chat-tabpanel"
      tabindex={tab === each ? 0 : -1}
      onclick={() => {
        ontab(each);
      }}
    >
      {#if each === 'group'}
        {t('chatGroup')}
      {:else if each === 'reports'}
        <Pictogram name="pushpin" size={16} />
        {t('reportsTab')}
        {#if reportCount > 0}<span class="count">{reportCount}</span>{/if}
      {:else}
        {t('chatMeshcore')}
        {#if radioTextCount > 0}<span class="count">{radioTextCount}</span>{/if}
      {/if}
    </button>
  {/each}
</div>

<style>
  /* The tabs head the panel, beside its close button. */
  .tabs {
    display: flex;
    flex: 1;
    gap: 0.25rem;
    min-width: 0;
    overflow-x: auto;
  }

  .tabs button {
    display: inline-flex;
    flex: none;
    gap: 0.35rem;
    align-items: center;
    padding-inline: 0.6rem;
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 0;
  }

  .tabs button[aria-selected='true'] {
    font-weight: 600;
    border-bottom-color: var(--accent-line);
  }

  .count {
    padding: 0 0.4rem;
    font-size: var(--text-small);
    border: 1px solid currentcolor;
    border-radius: var(--radius-pill);
  }
</style>
