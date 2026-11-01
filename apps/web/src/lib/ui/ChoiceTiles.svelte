<!-- A choice among a few options as a grid of tiles, a picture over a short name, so every option is
     in view at once and one tap picks it. Each tile is a radio button covering the whole tile,
     invisible: keyboards, screen readers and taps work as with any radio group, and the frame shows
     the choice. The one way the app draws such a choice. -->
<script lang="ts" generics="T extends string | number">
  import type { Snippet } from 'svelte';

  interface Props {
    legend: string;
    /** The radio group's name, unique in the form. */
    name: string;
    options: readonly { readonly value: T; readonly label: string }[];
    value: T;
    onchange: (value: T) => void;
    /** What each tile shows above its name. */
    picture: Snippet<[T]>;
  }

  let { legend, name, options, value, onchange, picture }: Props = $props();
</script>

<fieldset>
  <legend>{legend}</legend>
  <div class="choices">
    {#each options as option (option.value)}
      <label class="choice">
        <input
          type="radio"
          {name}
          value={option.value}
          checked={option.value === value}
          onchange={() => {
            onchange(option.value);
          }}
        />
        {@render picture(option.value)}
        <span>{option.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .choices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .choice {
    position: relative;
    display: grid;
    gap: 0.25rem;
    justify-items: center;
    padding: 0.4rem 0.25rem;
    font-size: var(--text-small);
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }

  .choice:has(input:checked) {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .choice:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }
</style>
