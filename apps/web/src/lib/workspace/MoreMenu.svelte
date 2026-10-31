<!-- The dock's "More" menu: the tools used now and then, with or without a group, the way to this
     device's settings, and the help, a page of the site that opens beside the app. -->
<script lang="ts">
  import { siteUrl } from '../config.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import type { GlyphName } from '../ui/glyphs.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    t: Translate;
    onmeasure: () => void;
    /** The diary is the active group's. */
    withGroup: boolean;
  }

  let { t, onmeasure, withGroup }: Props = $props();

  interface Item {
    readonly icon: GlyphName;
    readonly label: MessageKey;
    readonly run: () => void;
    readonly needsGroup?: boolean;
  }

  const ITEMS: readonly Item[] = [
    {
      icon: 'ruler',
      label: 'measure',
      run: () => {
        onmeasure();
      },
    },
    {
      icon: 'search',
      label: 'findCoordinate',
      run: () => {
        openPanel('find');
      },
    },
    {
      icon: 'journal',
      label: 'diary',
      run: () => {
        openPanel('diary');
      },
      needsGroup: true,
    },
    {
      icon: 'download',
      label: 'offlineAreas',
      run: () => {
        openPanel('offline');
      },
    },
    {
      icon: 'settings',
      label: 'settings',
      run: () => {
        openPanel('settings');
      },
    },
    {
      icon: 'help',
      label: 'help',
      run: () => {
        window.open(siteUrl(t('helpPath')), '_blank', 'noopener');
      },
    },
  ];
</script>

<DockMenu icon="more" label={t('more')}>
  {#snippet items(close: () => void)}
    {#each ITEMS.filter((item) => withGroup || item.needsGroup !== true) as item (item.label)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          item.run();
        }}
      >
        <Pictogram name={item.icon} size={20} />
        {t(item.label)}
      </button>
    {/each}
  {/snippet}
</DockMenu>
