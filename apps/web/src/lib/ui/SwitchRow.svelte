<!-- One on/off choice in a panel: a pictogram, what it is and its switch, all one button that
     screen readers hear as a switch. A choice whose name is not enough has an (i) beside it that
     shows what it does underneath (ui/InfoButton.svelte, ADR-0101). Off, the pictogram fades. The
     one way the app draws an on/off choice. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import InfoButton from './InfoButton.svelte';
  import Pictogram from './Pictogram.svelte';
  import Switch from './Switch.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    /** What the choice does, when its name is not enough, and what its (i) is called. */
    hint?: { readonly text: string; readonly label: string } | undefined;
    on: boolean;
    onclick: () => void;
  }

  let { icon, label, hint, on, onclick }: Props = $props();

  const id = $props.id();
  let open = $state(false);
</script>

<div class="switch-row">
  <button
    class="toggle"
    role="switch"
    aria-checked={on}
    aria-describedby={hint ? id : undefined}
    {onclick}
  >
    <Pictogram name={icon} size={20} />
    <span class="label">{label}</span>
    <span class="end"><Switch {on} /></span>
  </button>
  {#if hint}
    <span class="more">
      <InfoButton label={hint.label} controls={id} {open} onclick={() => (open = !open)} />
    </span>
    <!-- Hidden, it still describes the switch to screen readers. -->
    <p {id} class="hint" hidden={!open}>{hint.text}</p>
  {/if}
</div>

<style>
  /* The pictogram, the name, its (i) and the switch; what the choice does goes underneath. The
     switch is one button across the row, with the (i) over it. */
  .switch-row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    column-gap: 0.75rem;
  }

  .toggle {
    display: grid;
    grid-template-columns: subgrid;
    grid-row: 1;
    grid-column: 1 / -1;
    align-items: center;
    padding: 0.55rem 0.4rem;
    text-align: left;
    border-color: transparent;
  }

  .end {
    display: flex;
    grid-column: 4;
  }

  .more {
    display: flex;
    grid-row: 1;
    grid-column: 3;
    align-items: center;
    /* Only as wide as the (i): the rest of its column is the switch's to tap. */
    justify-self: start;
    margin-left: -0.75rem;
  }

  .hint {
    grid-row: 2;
    grid-column: 2 / -1;
    margin: 0;
    padding: 0 0.4rem 0.55rem;
    color: var(--muted);
    font-size: var(--text-small);
  }

  .toggle[aria-checked='false'] :global(svg) {
    opacity: 0.45;
  }
</style>
