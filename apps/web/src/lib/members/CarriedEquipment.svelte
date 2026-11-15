<!-- What this person carries, in Me (ADR-0133): each item a pill with a cross that drops it, and a
     button that opens the dialog where the rest is picked. A linked LoRa radio is not here: the
     sheet has a card of its own for it. -->
<script lang="ts">
  import type { Equipment, Profile } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import EquipmentPicker from './EquipmentPicker.svelte';
  import { EQUIPMENT } from './member-catalog.ts';

  interface Props {
    t: Translate;
    profile: Profile;
    equipment: readonly Equipment[];
    onequipment: (equipment: readonly Equipment[]) => void;
  }

  let { t, profile, equipment, onequipment }: Props = $props();

  const carried = $derived(EQUIPMENT.filter((item) => equipment.includes(item.value)));
  /** The dialog where equipment is picked is open. */
  let picking = $state(false);
</script>

<div class="chips">
  {#each carried as item (item.value)}
    <span class="chip carried">
      {t(item.label)}
      <button
        class="drop"
        aria-label={t('dropEquipment', { name: t(item.label) })}
        onclick={() => {
          onequipment(equipment.filter((value) => value !== item.value));
        }}><Pictogram name="close" size={12} /></button
      >
    </span>
  {:else}
    <span class="hint none">{t('equipmentNone')}</span>
  {/each}
  <button
    class="chip add"
    aria-label={t('addEquipment')}
    onclick={() => {
      picking = true;
    }}><Pictogram name="plus" size={14} />{t('add')}</button
  >
</div>
{#if picking}
  <EquipmentPicker
    {t}
    {profile}
    carried={equipment}
    {onequipment}
    onclose={() => {
      picking = false;
    }}
  />
{/if}

<style>
  /* What is carried, on the card's ground: each pill with its cross to drop it. */
  .carried {
    gap: 0.25rem;
    padding-right: 0.25rem;
    background: var(--surface);
  }

  .drop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    min-width: 0;
    height: 1.6rem;
    min-height: 0;
    padding: 0;
    color: var(--muted);
    background: var(--bg);
    border: none;
    border-radius: 50%;
  }

  .add {
    font-weight: 600;
    background: transparent;
    border-style: dashed;
    border-color: var(--control-line);
  }

  .none {
    align-self: center;
    margin-right: 0.25rem;
  }
</style>
