<!-- The bar above the map: the logo, the group in use, which opens the groups panel, and on the
     right how this device reaches it, which opens the connections panel. -->
<script lang="ts">
  // The logo comes from brand/, built by brand/build.py; the header is always ink, hence pale.
  import lockupUrl from '../../../../../brand/lockup-pale.svg';
  import markUrl from '../../../../../brand/mark.svg';
  import type { Translate } from '../i18n/index.ts';
  import { connection } from '../links/connection.svelte.ts';
  import LinkButton from '../links/LinkButton.svelte';
  import { linkOf, networkStatus, type LinkInput } from '../links/links.ts';
  import type { Session } from '../session.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { isOpen, togglePanel } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
    /** This device's identity and groups, once loaded: the group shows once there is an identity. */
    session: Session | undefined;
    /** How this device reaches its group now (lib/links). */
    linkInput: LinkInput;
  }

  let { t, session, linkInput }: Props = $props();

  const link = $derived(linkOf(linkInput));
</script>

<header class="bar chrome">
  <span class="brand">
    <img class="lockup" src={lockupUrl} alt="Tesel" />
    <img class="mark" src={markUrl} alt="Tesel" />
  </span>
  {#if session?.identity}
    {@const groupLabel = session.activeGroup
      ? session.nameOfGroup(session.activeGroup)
      : t('noGroup')}
    <button
      class="group"
      onclick={() => {
        togglePanel({ name: 'groups', start: 'home' });
      }}
      aria-expanded={isOpen('groups')}
      aria-label="{t('group')}: {groupLabel}"
    >
      <span class="caption">{t('group')}</span>
      <span class="name">{groupLabel}</span>
      <Pictogram name="chevron" size={16} />
    </button>
  {/if}
  <LinkButton
    {t}
    {link}
    network={connection.network}
    detail={t(networkStatus(linkInput).label)}
    expanded={isOpen('connections')}
    onclick={() => {
      togglePanel('connections');
    }}
  />
</header>

<style>
  /* The logo, the group in use, and on the right how this device reaches it. */
  .bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    /* Clear of a notch at the top, or at a side when the phone is held sideways. */
    padding: calc(0.3rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.3rem
      max(1rem, env(safe-area-inset-left));
  }

  /* A slim bar leaves the map the room: its two buttons are lower than the others, and alike. */
  .bar :global(button) {
    min-height: 2.5rem;
    border-color: var(--chrome-line);
  }

  .brand {
    display: flex;
    flex-shrink: 0;
  }

  .brand img {
    display: block;
    height: 1.45rem;
    width: auto;
  }

  .brand .mark {
    display: none;
  }

  /* On narrow screens the mark stands for the name. */
  @media (max-width: 30rem) {
    .brand .lockup {
      display: none;
    }

    .brand .mark {
      display: block;
      height: 1.7rem;
    }
  }

  /* Says what it is above the group's name, which is cut short rather than crowd the bar. */
  .group {
    display: grid;
    grid-template-columns: minmax(0, auto) auto;
    column-gap: 0.4rem;
    align-items: center;
    min-width: 0;
    padding: 0.15rem 0.5rem 0.15rem 0.65rem;
    line-height: 1.15;
    text-align: left;
  }

  .group .caption {
    grid-column: 1;
    color: var(--chrome-muted);
    font-size: var(--text-small);
  }

  .group .name {
    grid-column: 1;
    overflow: hidden;
    font-size: var(--text-secondary);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group :global(svg) {
    grid-row: 1 / span 2;
    grid-column: 2;
  }
</style>
