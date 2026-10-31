<!-- The card at the top of the map while a tool takes the taps on it (drawing, measuring): one short
     line of what to do or what there is so far, then small named buttons (ToolButton: undo, what
     else the tool can do, cancel) and, when the tool ends with something made, the button that
     finishes it. Short, so the map stays in view. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import MapCard from './MapCard.svelte';
  import ToolButton from './ToolButton.svelte';

  interface Props {
    /** What the card is about, as screen readers name it. */
    label: string;
    /** Takes back the last tap; none for a tool of one tap. */
    undo?:
      { readonly label: string; readonly disabled: boolean; readonly run: () => void } | undefined;
    closeLabel: string;
    onclose: () => void;
    /** The button that ends the tool with what it made; none for a tool that only shows. */
    finish?:
      { readonly label: string; readonly disabled: boolean; readonly run: () => void } | undefined;
    /** Other small buttons of the tool (ToolButton), between undo and close. */
    tools?: Snippet;
    /** The line of what to do or what there is, and any warning. */
    children: Snippet;
  }

  let { label, undo, closeLabel, onclose, finish, tools, children }: Props = $props();
</script>

<MapCard {label}>
  <div class="text">{@render children()}</div>
  <div class="controls">
    {#if undo}
      <ToolButton icon="undo" label={undo.label} disabled={undo.disabled} onclick={undo.run} />
    {/if}
    {@render tools?.()}
    <ToolButton icon="close" label={closeLabel} onclick={onclose} />
    {#if finish}
      <button class="primary finish" disabled={finish.disabled} onclick={finish.run}>
        {finish.label}
      </button>
    {/if}
  </div>
</MapCard>

<style>
  .text {
    display: grid;
    gap: 0.25rem;
  }

  .text :global(p) {
    margin: 0;
  }

  /* On a narrow phone the button that finishes goes under the others, at the right. */
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }

  .finish {
    margin-left: auto;
  }
</style>
