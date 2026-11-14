<!-- One button of the dock at the bottom of the map: a pictogram over a short label. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    /** A longer name for screen readers, when the label alone is not enough. */
    ariaLabel?: string;
    /** Lime, for a button whose state is on (sharing the position). */
    on?: boolean;
    /** Whether the panel or menu it opens is open. */
    expanded: boolean;
    /** A number to point out, such as the tasks waiting for this device; none when 0. */
    count?: number;
    onclick: () => void;
  }

  let { icon, label, ariaLabel, on = false, expanded, count = 0, onclick }: Props = $props();
</script>

<button class="dock-button" class:on aria-expanded={expanded} aria-label={ariaLabel} {onclick}>
  <span class="icon">
    <Pictogram name={icon} size={22} />
    {#if count > 0}<span class="count" aria-hidden="true">{count}</span>{/if}
  </span>
  <span class="label">{label}</span>
</button>

<style>
  .dock-button {
    display: grid;
    flex: 1;
    gap: 0.15rem;
    place-items: center;
    min-width: 3rem;
    padding: 0.45rem 0.15rem 0.4rem;
    font-size: var(--text-small);
    font-weight: 600;
    color: inherit;
    border: 0;
    border-radius: var(--radius-card);
  }

  .dock-button[aria-expanded='true'] {
    background: var(--chrome-pressed);
  }

  .icon {
    position: relative;
    display: grid;
  }

  .count {
    position: absolute;
    top: -0.35rem;
    right: -0.6rem;
    min-width: 1.2rem;
    padding: 0 0.25rem;
    font-size: var(--text-small);
    font-weight: 800;
    line-height: 1.2rem;
    color: var(--on-accent);
    text-align: center;
    background: var(--signal);
    border-radius: var(--radius-pill);
  }

  .dock-button.on :global(svg) {
    color: var(--signal);
  }

  /* On the rail of a phone held sideways (ADR-0130), the pictogram alone, a finger's size: the
     word is still the button's name for screen readers. */
  @media (orientation: landscape) and (max-height: 32rem) {
    .dock-button {
      flex: none;
      width: var(--control-size);
      height: var(--control-size);
      min-width: 0;
      padding: 0;
    }

    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
</style>
