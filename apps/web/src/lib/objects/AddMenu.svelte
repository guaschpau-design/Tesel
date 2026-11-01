<!-- The dock's "Add" menu: every new thing starts here, each named with a line on what it is for.
     A marker, a route or an area is drawn on the map next; a task or a report opens its form. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { newTask } from '../tasks/task-editor.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import type { GlyphName } from '../ui/glyphs.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { DRAFT_NAMES, type DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    /** Starts drawing a marker, a route or an area. */
    ondraw: (kind: DraftKind) => void;
  }

  let { t, ondraw }: Props = $props();

  /** What can be added: something drawn on the map, a task or a report. */
  type Thing = DraftKind | 'task' | 'report';

  const THINGS: readonly { thing: Thing; icon: GlyphName; label: MessageKey; hint: MessageKey }[] =
    [
      { thing: 'marker', icon: 'pin', label: DRAFT_NAMES.marker, hint: 'addMarkerHint' },
      { thing: 'route', icon: 'route', label: DRAFT_NAMES.route, hint: 'addRouteHint' },
      { thing: 'area', icon: 'area', label: DRAFT_NAMES.area, hint: 'addAreaHint' },
      { thing: 'task', icon: 'task', label: 'addTask', hint: 'addTaskHint' },
      { thing: 'report', icon: 'pushpin', label: 'addReport', hint: 'addReportHint' },
    ];

  function add(thing: Thing): void {
    if (thing === 'task') newTask(null);
    else if (thing === 'report') openPanel('report');
    else ondraw(thing);
  }
</script>

<DockMenu icon="plus" label={t('add')}>
  {#snippet items(close: () => void)}
    {#each THINGS as item (item.thing)}
      <!-- The line is a description, not part of the name, so each item is still called by it. -->
      <button
        role="menuitem"
        aria-describedby="add-{item.thing}-hint"
        onclick={() => {
          close();
          add(item.thing);
        }}
      >
        <Pictogram name={item.icon} size={20} />
        <span class="thing">
          {t(item.label)}
          <small id="add-{item.thing}-hint">{t(item.hint)}</small>
        </span>
      </button>
    {/each}
  {/snippet}
</DockMenu>

<style>
  .thing {
    display: grid;
    line-height: 1.25;
  }

  small {
    font-size: var(--text-secondary);
    font-weight: 400;
    color: var(--muted);
  }
</style>
