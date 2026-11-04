<!-- The elevation profile of the straight way from this device to a point (ADR-0115): the ground
     drawn to scale, with round heights marked, this device at the left and the point at the right;
     below it, how much the way climbs and descends and its steepest stretch. -->
<script lang="ts">
  import { formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { climbMetres } from './climb.ts';
  import { PROFILE_HEIGHT, PROFILE_WIDTH, profileDrawing } from './profile.ts';
  import type { WayElevations } from './way-climb.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** The way read so far; null while it is first being read. */
    way: WayElevations | null;
    /** Its length, in metres. */
    length: number;
  }

  let { t, locale, way, length }: Props = $props();

  const drawing = $derived(
    way?.climb ? profileDrawing(way.elevations as readonly number[], length) : null,
  );
  /** Said only where the heights are stretched enough to mislead, rounded as it reads. */
  const stretched = $derived(
    drawing && drawing.exaggeration >= 1.5 ? Math.round(drawing.exaggeration) : null,
  );
</script>

{#if way === null}
  <p class="note">{t('elevationReading')}</p>
{:else if way.climb === null || drawing === null}
  <p class="note">{t('elevationUnknown')}</p>
{:else}
  {@const heights = way.elevations as readonly number[]}
  <figure class="profile">
    <svg
      viewBox="0 0 {PROFILE_WIDTH} {PROFILE_HEIGHT}"
      role="img"
      aria-label={t('elevationProfileLabel', {
        low: String(Math.round(Math.min(...heights))),
        high: String(Math.round(Math.max(...heights))),
        distance: formatDistance(length, locale),
      })}
    >
      {#each drawing.levels as level (level.metres)}
        <line class="level" x1={drawing.left} x2={drawing.right} y1={level.y} y2={level.y} />
        <text
          class="axis"
          x={drawing.left - 6}
          y={level.y}
          text-anchor="end"
          dominant-baseline="middle"
        >
          {level.metres} m
        </text>
      {/each}
      <path class="ground" d={drawing.area} />
      <path class="line" d={drawing.line} />
      <text class="axis" x={drawing.left} y={PROFILE_HEIGHT - 6}>{t('elevationYou')}</text>
      <text class="axis" x={drawing.right} y={PROFILE_HEIGHT - 6} text-anchor="end">
        {formatDistance(length, locale)}
      </text>
    </svg>
    <figcaption>
      <span class="climb">
        {t('climb', {
          up: climbMetres(way.climb.up),
          down: climbMetres(way.climb.down),
          steepest: String(Math.round(way.climb.steepest)),
        })}
      </span>
      {#if stretched}<span class="note"
          >{t('elevationStretched', { times: String(stretched) })}</span
        >{/if}
    </figcaption>
  </figure>
{/if}

<style>
  .profile {
    display: grid;
    gap: 0.4rem;
    margin: 0;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    font-size: 11px;
  }

  .level {
    stroke: var(--border);
    stroke-width: 1;
  }

  .axis {
    fill: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .ground {
    fill: var(--accent-line);
    fill-opacity: 0.16;
  }

  .line {
    fill: none;
    stroke: var(--accent-line);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
  }

  .climb {
    font-variant-numeric: tabular-nums;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
