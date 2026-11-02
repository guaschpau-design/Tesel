<!-- A small (i) beside what it explains, which shows or hides the explanation. What a choice
     does is read once, then gets in the way: so it stays hidden until asked for, and stays shown
     until hidden again, never on a timer that could hide it mid-sentence (ADR-0101). The one way
     the app offers a second level of information. -->
<script lang="ts">
  import Pictogram from './Pictogram.svelte';

  interface Props {
    /** What it explains, as screen readers name the button. */
    label: string;
    /** The id of the explanation it shows and hides. */
    controls: string;
    open: boolean;
    onclick: () => void;
  }

  let { label, controls, open, onclick }: Props = $props();
</script>

<!-- Never a form's submit button, whatever form it is in. -->
<button
  type="button"
  class="info"
  aria-label={label}
  aria-expanded={open}
  aria-controls={controls}
  onclick={(event) => {
    // Inside a row that is a button of its own, a tap here is for this button only.
    event.stopPropagation();
    onclick();
  }}
>
  <Pictogram name="info" size={18} />
</button>

<style>
  /* Small to the eye, as large as a fingertip to tap. */
  .info {
    display: inline-grid;
    place-items: center;
    width: var(--control-size);
    min-height: var(--control-size);
    padding: 0;
    color: var(--muted);
    border-color: transparent;
    border-radius: 50%;
  }

  .info[aria-expanded='true'] {
    color: var(--fg);
  }
</style>
