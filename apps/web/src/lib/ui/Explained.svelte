<!-- Something with an (i) beside it, and underneath what the (i) shows: how a part of the app
     works, read once and then hidden (ui/InfoButton.svelte, ADR-0101). On/off choices have the
     same in ui/SwitchRow.svelte. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import InfoButton from './InfoButton.svelte';

  interface Props {
    /** What the (i) is called. */
    label: string;
    /** What it shows. */
    text: string;
    /** What it stands beside: a heading, a button, a field's name. */
    children: Snippet;
  }

  let { label, text, children }: Props = $props();

  const id = $props.id();
  let open = $state(false);
</script>

<div class="explained">
  <div class="beside">
    {@render children()}
    <InfoButton {label} controls={id} {open} onclick={() => (open = !open)} />
  </div>
  <p {id} class="hint" hidden={!open}>{text}</p>
</div>

<style>
  .explained {
    display: grid;
    gap: 0.25rem;
  }

  /* The (i) a little closer to what it explains than its fingertip size would put it. */
  .beside {
    display: flex;
    gap: 0;
    align-items: center;
    margin-right: auto;
  }

  .hint {
    margin: 0;
  }
</style>
