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

  const DRAWINGS: Readonly<Record<BaseMap, Snippet>> = { topo, urban, aerial, tactical, night };
  const drawing = $derived(DRAWINGS[base]);
</script>

{#snippet tactical()}
  <rect width="96" height="64" fill="#101315" />
  <rect x="54" y="2" width="40" height="26" rx="3" fill="#162019" />
  <g fill="none" stroke="#3d5246" stroke-width="1">
    <ellipse cx="24" cy="20" rx="20" ry="13" />
    <ellipse cx="24" cy="20" rx="12" ry="7" />
  </g>
  <path d="M0 50 Q48 34 96 44" stroke="#2f78b0" stroke-width="3" fill="none" />
  <g stroke="#4fb8c4" stroke-width="0.8" opacity="0.6">
    <path d="M0 22H96M0 44H96M32 0V64M64 0V64" />
  </g>
  <path d="M-4 62L100 6" stroke="#c9cdd1" stroke-width="4" />
  <path d="M52 37l-4 4M60 32l4 -4" stroke="#c98a1e" stroke-width="2" />
  <rect x="68" y="44" width="8" height="8" fill="#f0b43c" />
{/snippet}

{#snippet night()}
  <rect width="96" height="64" fill="#050000" />
  <rect x="54" y="2" width="40" height="26" rx="3" fill="#160404" />
  <g fill="none" stroke="#4a1111" stroke-width="1">
    <ellipse cx="24" cy="20" rx="20" ry="13" />
    <ellipse cx="24" cy="20" rx="12" ry="7" />
  </g>
  <path d="M0 50 Q48 34 96 44" stroke="#7a1c1c" stroke-width="3" fill="none" />
  <g stroke="#8f2626" stroke-width="0.8" opacity="0.7">
    <path d="M0 22H96M0 44H96M32 0V64M64 0V64" />
  </g>
  <path d="M-4 62L100 6" stroke="#c03030" stroke-width="4" />
  <rect x="68" y="44" width="8" height="8" fill="#ff6b5a" />
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

{#snippet urban()}
  <rect width="96" height="64" fill="#e7e5e0" />
  <g fill="#d4d0c8" stroke="#a9a39a" stroke-width="0.8">
    <rect x="4" y="4" width="22" height="16" />
    <rect x="34" y="4" width="26" height="16" />
    <rect x="68" y="4" width="24" height="16" />
    <rect x="4" y="30" width="22" height="14" />
    <rect x="34" y="30" width="26" height="14" />
    <rect x="68" y="30" width="24" height="30" />
    <rect x="4" y="52" width="56" height="10" />
  </g>
  <g stroke="#ffffff" stroke-width="5" fill="none">
    <path d="M0 25H96M0 48H64M30 0V64M64 0V64" />
  </g>
  <path d="M38 25h10M45 22l3 3-3 3" stroke="#6b6f74" stroke-width="1.2" fill="none" />
  <path d="M6 12h8M36 12h12M70 12h10" stroke="#2f3337" stroke-width="1.6" />
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
