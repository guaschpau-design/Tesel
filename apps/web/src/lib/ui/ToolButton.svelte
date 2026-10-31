<!-- A small button of a tool's card (ToolCard): its pictogram over a short name, so what it does is
     read, not guessed. Screen readers hear the longer name when there is one. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    icon: GlyphName;
    /** The short name under the pictogram. */
    label: string;
    /** What it does in full, when the short name leaves it out: "Type coordinates". */
    name?: string | undefined;
    disabled?: boolean;
    /** For a button that shows or hides a part of the card: whether it is shown. */
    expanded?: boolean | undefined;
    onclick: () => void;
  }

  let { icon, label, name, disabled = false, expanded, onclick }: Props = $props();
</script>

<button class="tool" aria-label={name} title={name} aria-expanded={expanded} {disabled} {onclick}>
  <Pictogram name={icon} size={20} />
  <span>{label}</span>
</button>

<style>
  .tool {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    min-width: 3.25rem;
    padding: 0.3rem 0.35rem 0.2rem;
    font-size: var(--text-small);
    line-height: 1.1;
  }
</style>
