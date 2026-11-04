<!-- A section that opens with a tap: closed, one line says what it holds and the gist of it, so a
     panel stays short and can be read at a glance. -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  import Pictogram from './Pictogram.svelte';

  interface Props {
    title: string;
    /** The gist, shown beside the title. */
    summary: string;
    /**
     * Opens it at first, as when what it holds needs looking at; from then on it is the person's
     * to open and close, whatever changes inside.
     */
    open?: boolean;
    /** Each time it is opened, for what is worked out only when looked at. */
    onopen?: () => void;
    children: Snippet;
  }

  let { title, summary, open = false, onopen, children }: Props = $props();

  let details: HTMLDetailsElement;

  // Set once, by hand: as an attribute, Svelte sets it again with the title and the gist, and a
  // change inside would close the fold under the finger.
  onMount(() => {
    details.open = open;
  });
</script>

<details class="fold" bind:this={details} ontoggle={() => details.open && onopen?.()}>
  <summary>
    <span class="title">{title}</span>
    <span class="summary">{summary}</span>
    <span class="chevron"><Pictogram name="chevron" size={18} /></span>
  </summary>
  <div class="content stack">{@render children()}</div>
</details>

<style>
  /* As narrow as its panel, however long the gist: the gist is cut short instead. */
  .fold {
    min-width: 0;
    border-top: 1px solid var(--border);
  }

  summary {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.6rem 0;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* A chevron, the same as the top bar's, that points down once the section opens. */
  .chevron {
    flex: none;
    align-self: center;
    margin-left: auto;
    rotate: -90deg;
    transition: rotate 0.15s;
  }

  .fold[open] > summary .chevron {
    rotate: 0deg;
  }

  .title {
    font-weight: 600;
  }

  .summary {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .content {
    padding-bottom: 0.75rem;
  }
</style>
