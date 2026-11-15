<!-- A member's profile as a tag beside their name (ADR-0133). On this device's own card it is a
     choice: a tap opens the list of profiles, as the phone shows a choice, and picking one closes
     it. On anyone else's it only says what they are, and nothing when they have not said. -->
<script lang="ts">
  import type { Profile } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { PROFILES, profileLabel } from './member-catalog.ts';

  interface Props {
    t: Translate;
    profile: Profile;
    /** Set where the profile is chosen: this device's own card. */
    onprofile?: ((profile: Profile) => void) | undefined;
  }

  let { t, profile, onprofile }: Props = $props();

  const unspecified = $derived(profile === 'unspecified');
  /** "Sin indicar" goes last: a choice to undo, not one to make. */
  const choices = [
    ...PROFILES.filter((item) => item.value !== 'unspecified'),
    ...PROFILES.filter((item) => item.value === 'unspecified'),
  ];
</script>

{#if onprofile}
  {@const choose = onprofile}
  <!-- The tag shows the profile; the list itself is the browser's own, over it. -->
  <span class="tag choice" class:unspecified>
    <span aria-hidden="true">{unspecified ? t('chooseProfile') : t(profileLabel(profile))} ▾</span>
    <select
      aria-label={t('profileLabel')}
      value={profile}
      onchange={(event) => {
        const chosen = PROFILES.find((item) => item.value === event.currentTarget.value);
        if (chosen) choose(chosen.value);
      }}
    >
      {#each choices as item (item.value)}
        <option value={item.value}>{t(item.label)}</option>
      {/each}
    </select>
  </span>
{:else if !unspecified}
  <span class="tag">{t(profileLabel(profile))}</span>
{/if}

<style>
  .tag {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    max-width: 100%;
    padding: 0.15rem 0.65rem;
    overflow: hidden;
    color: var(--accent-line);
    font-size: var(--text-secondary);
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    background: var(--accent-tint);
    border: 1px solid var(--accent-tint-line);
    border-radius: var(--radius-pill);
  }

  .tag.unspecified {
    color: var(--fg);
    background: var(--bg);
    border-color: var(--control-line);
    border-style: dashed;
  }

  /* The list is over the tag, unseen: a tap anywhere on the tag opens it. */
  select {
    position: absolute;
    inset: 0;
    width: 100%;
    min-height: 0;
    padding: 0;
    font-size: 1rem;
    cursor: pointer;
    opacity: 0;
  }

  .choice:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
