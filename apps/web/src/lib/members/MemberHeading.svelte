<!-- A member's name heading their card, in Me and in anyone else's, with what goes beside it: their
     profile as a tag and, in Me, the button that renames them (ADR-0133). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    name: string;
    children?: Snippet;
  }

  let { name, children }: Props = $props();
</script>

<div class="who">
  <h2>{name}</h2>
  {@render children?.()}
</div>

<style>
  .who {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: center;
    min-width: 0;
  }

  h2 {
    min-width: 0;
    max-width: 100%;
    margin: 0;
    overflow: hidden;
    font-size: var(--text-title);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
