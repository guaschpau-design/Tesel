<!-- What this person carries, picked in a dialog opened from Me (ADR-0133): first what their
     profile most often carries, then the rest in its four groups. Each tap marks or unmarks an
     item at once; "Listo" closes. -->
<script lang="ts">
  import type { Equipment, Profile } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import {
    EQUIPMENT,
    EQUIPMENT_GROUPS,
    TYPICAL_EQUIPMENT,
    profileLabel,
  } from './member-catalog.ts';

  interface Props {
    t: Translate;
    profile: Profile;
    carried: readonly Equipment[];
    onequipment: (equipment: readonly Equipment[]) => void;
    onclose: () => void;
  }

  let { t, profile, carried, onequipment, onclose }: Props = $props();

  const typical = $derived(TYPICAL_EQUIPMENT[profile]);
  /** The profile's items, then each group without them: every item once. */
  const sections = $derived([
    ...(typical.length === 0
      ? []
      : [
          {
            title: t('equipmentTypical', { profile: t(profileLabel(profile)) }),
            items: EQUIPMENT.filter((item) => typical.includes(item.value)).sort(
              (a, b) => typical.indexOf(a.value) - typical.indexOf(b.value),
            ),
          },
        ]),
    ...EQUIPMENT_GROUPS.map((group) => ({
      title: t(group.label),
      items: group.items.filter((item) => !typical.includes(item.value)),
    })),
  ]);

  function toggle(item: Equipment): void {
    onequipment(
      carried.includes(item) ? carried.filter((value) => value !== item) : [...carried, item],
    );
  }
</script>

{#snippet chip(item: { value: Equipment; label: MessageKey })}
  {@const on = carried.includes(item.value)}
  <button
    class="chip"
    aria-pressed={on}
    onclick={() => {
      toggle(item.value);
    }}
  >
    {#if on}<Pictogram name="check" size={14} />{/if}
    {t(item.label)}
  </button>
{/snippet}

<Dialog title={t('sheetEquipment')} oncancel={onclose}>
  <div class="sections">
    {#each sections as section (section.title)}
      <fieldset>
        <legend>{section.title}</legend>
        <div class="chips">
          {#each section.items as item (item.value)}{@render chip(item)}{/each}
        </div>
      </fieldset>
    {/each}
  </div>
  <div class="done">
    <button class="primary" onclick={onclose}>{t('done')}</button>
  </div>
</Dialog>

<style>
  .sections {
    display: grid;
    gap: 0.9rem;
  }

  legend {
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .done {
    position: sticky;
    bottom: -1.25rem;
    display: flex;
    justify-content: flex-end;
    margin: 1rem -1.25rem -1.25rem;
    padding: 0.75rem 1.25rem 1.25rem;
    background: var(--surface);
  }
</style>
