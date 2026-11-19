<!-- One row of Settings that picks one of a few choices from a list, laid out like the switches
     above it: a pictogram, what is chosen, and the choice now, which the phone's own list changes.
     Remembered as the preference it shows. -->
<script lang="ts" generics="T extends string">
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    preference: Preference<T>;
    options: readonly { readonly value: T; readonly label: string }[];
  }

  let { icon, label, preference, options }: Props = $props();
</script>

<label class="choice">
  <Pictogram name={icon} size={20} />
  <span>{label}</span>
  <select
    value={preference.value}
    onchange={(event) => {
      const { value } = event.currentTarget;
      const chosen = options.find((option) => option.value === value);
      if (chosen) void preference.set(chosen.value);
    }}
  >
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</label>

<style>
  .choice {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.3rem 0.4rem;
    font-size: inherit;
  }
</style>
