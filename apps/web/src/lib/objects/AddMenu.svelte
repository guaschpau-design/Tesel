<!-- The dock's "Add" menu: every new thing starts here. A marker, a route or an area is drawn on the
     map next; a task or a report opens its form. -->
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

  const THINGS: readonly { thing: Thing; icon: GlyphName; label: MessageKey }[] = [
    { thing: 'marker', icon: 'pin', label: DRAFT_NAMES.marker },
    { thing: 'route', icon: 'route', label: DRAFT_NAMES.route },
    { thing: 'area', icon: 'area', label: DRAFT_NAMES.area },
    { thing: 'task', icon: 'task', label: 'addTask' },
    { thing: 'report', icon: 'pushpin', label: 'addReport' },
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
      <button
        role="menuitem"
        onclick={() => {
          close();
          add(item.thing);
        }}
      >
        <Pictogram name={item.icon} size={20} />
        {t(item.label)}
      </button>
    {/each}
  {/snippet}
</DockMenu>
