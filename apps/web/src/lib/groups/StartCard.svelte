<!-- On the map while this device is in no group: the two ways to start, each opening the groups
     panel on it, and the help, which shows in one page how the app works. Gone as soon as there is
     a group. -->
<script lang="ts">
  import { siteUrl } from '../config.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { openPanel, type GroupsStart } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    t: Translate;
  }

  let { t }: Props = $props();

  const WAYS: readonly { start: GroupsStart; icon: GlyphName; label: MessageKey }[] = [
    { start: 'create', icon: 'plus', label: 'createGroup' },
    { start: 'join', icon: 'qr', label: 'joinGroup' },
  ];
</script>

<MapCard label={t('startTitle')}>
  <strong>{t('startTitle')}</strong>
  <div class="ways">
    {#each WAYS as way (way.start)}
      <button
        onclick={() => {
          openPanel({ name: 'groups', start: way.start });
        }}
      >
        <Pictogram name={way.icon} size={24} />
        {t(way.label)}
      </button>
    {/each}
    <a href={siteUrl(t('helpPath'))} target="_blank" rel="noopener">
      <Pictogram name="help" size={24} />
      {t('howItWorks')}
    </a>
  </div>
</MapCard>

<style>
  .ways {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }

  /* The help is a link, to a page of the site, laid out like the buttons beside it. */
  .ways button,
  .ways a {
    display: grid;
    gap: 0.3rem;
    place-items: center;
    min-height: var(--control-size);
    padding: 0.6rem 0.3rem;
    color: inherit;
    font-size: var(--text-secondary);
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
</style>
