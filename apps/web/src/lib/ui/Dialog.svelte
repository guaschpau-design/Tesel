<!-- A modal card for decisions that must be taken before going on (first launch, joining, a
     confirmation, describing what was drawn). -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    /** What Escape does; without it Escape does nothing, and the parent decides when it closes. */
    oncancel?: () => void;
    children: Snippet;
  }

  let { title, oncancel, children }: Props = $props();

  let dialog: HTMLDialogElement;
  const titleId = `dialog-${crypto.randomUUID()}`;

  onMount(() => {
    dialog.showModal();
    // Closed before it goes, the browser gives the focus back to what had it before.
    return () => {
      dialog.close();
    };
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    oncancel?.();
  }}
>
  <h2 id={titleId}>{title}</h2>
  {@render children()}
</dialog>

<style>
  dialog {
    box-sizing: border-box;
    width: min(26rem, calc(100vw - 2rem));
    /* A long one, such as the list of symbols, scrolls inside rather than off the screen. */
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    padding: 1.25rem;
    color: var(--fg);
    /* A long word, in a group's name or a server's address, breaks rather than widen the dialog. */
    overflow-wrap: anywhere;
    background: var(--surface);
    border: none;
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-dialog);
  }

  dialog::backdrop {
    background: rgb(15 23 42 / 55%);
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: var(--text-title);
  }
</style>
