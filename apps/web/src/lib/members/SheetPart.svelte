<!-- One part of a member's sheet: a card with its title, small, over what it holds (ADR-0133).
     Shown whole, never folded: the sheet is read at a glance. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
  }

  let { title, children }: Props = $props();
</script>

<section class="part">
  <h3>{title}</h3>
  <div class="content">{@render children()}</div>
</section>

<style>
  .part {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.45rem;
    align-content: start;
    padding: 0.7rem 0.75rem 0.8rem;
    background: var(--bg);
    border-radius: var(--radius-card);
  }

  h3 {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.45rem;
  }

  .content > :global(p) {
    margin: 0;
  }
</style>
