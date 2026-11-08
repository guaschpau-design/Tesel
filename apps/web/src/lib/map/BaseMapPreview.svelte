<!-- A small drawing of what each base map looks like, for choosing one at a glance. Drawn, not a
     picture of real tiles, so it weighs nothing and works offline. Each base map has its drawing in
     DRAWINGS, so a new base map does not compile without one. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { BaseMap } from './style/style.ts';

  interface Props {
    base: BaseMap;
  }

  let { base }: Props = $props();

  const DRAWINGS: Readonly<Record<BaseMap, Snippet>> = { topo, aerial, tactical };
  const drawing = $derived(DRAWINGS[base]);
</script>

{#snippet tactical()}
  <rect width="96" height="64" fill="#141516" />
  <rect x="56" y="4" width="34" height="22" rx="3" fill="#18201a" />
  <path d="M0 50 Q48 30 96 46" stroke="#0e1a22" stroke-width="6" fill="none" />
  <g stroke="#34383d" stroke-width="4" fill="none">
    <path d="M0 36H96M28 0V64M72 30V64M0 14H48" />
  </g>
  <path d="M-4 62L100 6" stroke="#5a6067" stroke-width="5" />
  <circle cx="44" cy="26" r="4" fill="#99c938" stroke="#0f1011" stroke-width="2" />
{/snippet}

{#snippet topo()}
  <rect width="96" height="64" fill="#f3eed8" />
  <g fill="none" stroke="#c49a6c" stroke-width="1.3">
    <path d="M18 50C8 30 30 6 52 10C78 14 88 40 72 54C56 66 28 62 18 50Z" />
    <path d="M28 46C22 32 38 16 52 19C70 22 76 40 64 48C52 57 34 56 28 46Z" />
    <path d="M38 42C35 33 44 27 52 29C61 31 63 40 57 44C50 49 41 48 38 42Z" />
  </g>
  <path d="M80 0C74 16 88 26 80 44" stroke="#58a6d6" stroke-width="1.8" fill="none" />
  <path
    d="M0 60C20 52 32 62 50 56S80 40 96 46"
    stroke="#d9433b"
    stroke-width="1.8"
    stroke-dasharray="4 2.5"
    fill="none"
  />
{/snippet}

{#snippet aerial()}
  <rect width="96" height="64" fill="#5c6b45" />
  <path d="M0 0H42L32 30H0Z" fill="#7f8c55" />
  <path d="M42 0H96V22L36 34Z" fill="#a69769" />
  <path d="M0 30L36 34L30 64H0Z" fill="#475a30" />
  <path d="M36 34L96 22V64H30Z" fill="#8e9c5d" />
  <path d="M30 64L42 0" stroke="#ddd6c4" stroke-width="2.5" />
  <g fill="#33502a">
    <circle cx="66" cy="46" r="6" />
    <circle cx="76" cy="52" r="5" />
    <circle cx="12" cy="44" r="5" />
  </g>
  <g fill="#e1dccf">
    <rect x="60" y="6" width="9" height="7" />
    <rect x="72" y="9" width="7" height="6" />
  </g>
{/snippet}

<svg viewBox="0 0 96 64" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
  {@render drawing()}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 2;
    border-radius: var(--radius-control);
  }
</style>
