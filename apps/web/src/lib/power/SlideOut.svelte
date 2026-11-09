<!-- The way out of pocket mode (ADR-0127): a handle slid to the end of its track. A tap, a hand in a
     pocket or the phone moved does nothing; let go before the end, it slides back. From the keyboard,
     Enter on the handle does it. Leaving waits a moment after the finger lifts, so that what follows
     the lift does not reach what is under pocket mode. -->
<script lang="ts">
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    /** What the track says: how to leave. */
    label: string;
    /** Brighter for a moment, as when a touch did nothing. */
    called: boolean;
    onout: () => void;
  }

  let { label, called, onout }: Props = $props();

  /** How far along the track the handle must be let go, from 0 to 1. */
  const FAR_ENOUGH = 0.85;
  /** How long after the handle reaches the end the app comes back, in milliseconds. */
  const LEAVE_MS = 250;

  let track: HTMLDivElement;
  let handle: HTMLButtonElement;
  let offset = $state(0);
  /** How far along the handle is, from 0 to 1: the label fades as it goes. */
  let progress = $state(0);
  let dragging = $state(false);
  let from = 0;

  /** How far the handle can go. */
  function room(): number {
    return Math.max(0, track.clientWidth - handle.offsetWidth);
  }

  function place(at: number): void {
    offset = at;
    progress = room() === 0 ? 0 : at / room();
  }

  function leave(): void {
    place(room());
    setTimeout(onout, LEAVE_MS);
  }

  function down(event: PointerEvent): void {
    dragging = true;
    from = event.clientX - offset;
    handle.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (dragging) place(Math.min(room(), Math.max(0, event.clientX - from)));
  }

  function up(): void {
    if (!dragging) return;
    dragging = false;
    if (progress >= FAR_ENOUGH) leave();
    else place(0);
  }
</script>

<div class="track" class:called bind:this={track}>
  <span class="label" style:opacity={1 - progress}>{label}</span>
  <button
    class="handle"
    class:dragging
    aria-label={label}
    bind:this={handle}
    style:translate="{offset}px 0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => {
      dragging = false;
      place(0);
    }}
    onclick={(event) => {
      // A tap is not a slide; a key is handled below.
      event.preventDefault();
    }}
    onkeydown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      leave();
    }}
  >
    <Pictogram name="chevron" size={26} />
  </button>
</div>

<style>
  .track {
    position: relative;
    display: flex;
    align-items: center;
    width: min(20rem, 100%);
    height: 3.6rem;
    padding: 0.3rem;
    background: #111214;
    border: 1px solid #2a2c2f;
    border-radius: 999px;
    transition: border-color 0.3s;
  }

  .track.called {
    border-color: #6b7075;
  }

  .label {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding-left: 3rem;
    color: #83878c;
    font-size: 0.95rem;
    pointer-events: none;
  }

  .track.called .label {
    color: #c3c6c9;
  }

  .handle {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    min-height: 0;
    padding: 0;
    color: #c3c6c9;
    background: #2a2c2f;
    border: 0;
    border-radius: 50%;
    touch-action: none;
    transition: translate 0.25s;
  }

  .handle.dragging {
    transition: none;
  }

  /* The chevron points the way to slide. */
  .handle :global(svg) {
    rotate: -90deg;
  }
</style>
