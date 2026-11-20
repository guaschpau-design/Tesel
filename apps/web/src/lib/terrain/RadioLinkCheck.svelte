<!-- Under how far a point is, on the tactical map: whether a radio reaches it from here over the
     ground (radio-link.ts, ADR-0159). Asked for with a button; then the verdict, the ground's
     profile with the signal's line and the edge of the zone it needs clear, and the antennas'
     height to choose. The link is drawn on the map while shown (RadioLinkLayer.svelte). -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import type { Heights } from './elevation.ts';
  import { profileDrawing, PROFILE_HEIGHT, PROFILE_WIDTH } from './profile.ts';
  import { ANTENNA_HEIGHTS, radioLink, type AntennaHeight, type RadioLink } from './radio-link.ts';
  import { radioLinks } from './radio-link.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** This device, when its position is known. */
    from: LatLon | null;
    to: LatLon;
    heights: Heights;
  }

  let { t, locale, from, to, heights }: Props = $props();

  const ANTENNA_LABELS: Readonly<Record<AntennaHeight, MessageKey>> = {
    1.5: 'radioHand',
    5: 'radioMast5',
    10: 'radioMast10',
  };

  let asked = $state(false);
  /** The link worked out: null while first read, 'unknown' where an elevation is not known. */
  let link = $state.raw<RadioLink | 'unknown' | null>(null);

  $effect(() => {
    if (!asked || from === null) return;
    const ends = { from, to };
    const antenna = radioLinks.antenna;
    let current = true;
    void radioLink(heights, ends.from, ends.to, antenna).then((result) => {
      if (!current) return;
      link = result ?? 'unknown';
      radioLinks.shown = result === null ? null : { ...ends, link: result };
    });
    return () => {
      current = false;
    };
  });

  // Off the map once the panel goes, or the link is hidden.
  $effect(() => {
    if (!asked) return;
    return () => {
      radioLinks.shown = null;
    };
  });

  function hide(): void {
    asked = false;
    link = null;
  }

  const drawing = $derived(
    link !== null && link !== 'unknown'
      ? profileDrawing(
          link.points.map((point) => point.ground),
          link.length,
          link.points.flatMap((point) => [point.line, point.line - point.zone]),
        )
      : null,
  );
  const verdict = $derived.by(() => {
    if (link === null || link === 'unknown') return '';
    const { verdict } = link;
    switch (verdict.kind) {
      case 'clear':
        return t('radioLinkClear');
      case 'grazing':
        return t('radioLinkGrazing', { distance: formatDistance(verdict.metres, locale) });
      case 'blocked':
        return t('radioLinkBlocked', {
          distance: formatDistance(verdict.metres, locale),
          height: Math.round(verdict.height),
        });
    }
  });
</script>

{#if !asked}
  <button class="ask" onclick={() => (asked = true)}>
    <Pictogram name="signal" size={18} />
    {t('radioLinkFromYou')}
  </button>
{:else}
  <section class="link" aria-label={t('radioLink')}>
    <header>
      <strong>{t('radioLink')}</strong>
      <button onclick={hide}>{t('hideViewshed')}</button>
    </header>
    {#if from === null}
      <p class="note">{t('radioLinkNoFix')}</p>
    {:else if link === null}
      <p class="note">{t('elevationReading')}</p>
    {:else if link === 'unknown'}
      <p class="note">{t('elevationUnknown')}</p>
    {:else}
      <p class="verdict {link.verdict.kind}">{verdict}</p>
      {#if drawing}
        <svg
          viewBox="0 0 {PROFILE_WIDTH} {PROFILE_HEIGHT}"
          role="img"
          aria-label={t('radioLinkProfileLabel', { distance: formatDistance(link.length, locale) })}
        >
          {#each drawing.levels as level (level.metres)}
            <line class="level" x1={drawing.left} x2={drawing.right} y1={level.y} y2={level.y} />
            <text
              class="axis"
              x={drawing.left - 6}
              y={level.y}
              text-anchor="end"
              dominant-baseline="middle">{level.metres} m</text
            >
          {/each}
          <path class="ground" d={drawing.area} />
          <path
            class="edge"
            d={drawing.path(link.points.map((point) => point.line - point.zone))}
          />
          <path class="signal" d={drawing.path(link.points.map((point) => point.line))} />
          <text class="axis" x={drawing.left} y={PROFILE_HEIGHT - 6}>{t('elevationYou')}</text>
          <text class="axis" x={drawing.right} y={PROFILE_HEIGHT - 6} text-anchor="end"
            >{formatDistance(link.length, locale)}</text
          >
        </svg>
      {/if}
    {/if}
    <fieldset class="antennas">
      <legend>{t('radioAntennas')}</legend>
      {#each ANTENNA_HEIGHTS as height (height)}
        <label class:chosen={radioLinks.antenna === height}>
          <input
            type="radio"
            name="antenna"
            checked={radioLinks.antenna === height}
            onchange={() => (radioLinks.antenna = height)}
          />
          {t(ANTENNA_LABELS[height])}
        </label>
      {/each}
    </fieldset>
    <p class="note">{t('radioLinkTerrainOnly')}</p>
  </section>
{/if}

<style>
  .ask {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-self: start;
  }

  .link {
    display: grid;
    gap: 0.5rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .verdict {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--accent-line);
    border-radius: var(--radius-control);
    background: var(--accent-tint);
  }

  .verdict.grazing {
    border-color: var(--warning);
    background: none;
  }

  .verdict.blocked {
    border-color: var(--danger);
    background: var(--danger-tint);
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
    fill: var(--map-terrain);
    fill-opacity: 0.3;
  }

  .signal {
    fill: none;
    stroke: var(--info);
    stroke-width: 2;
  }

  .edge {
    fill: none;
    stroke: var(--info);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    stroke-opacity: 0.6;
  }

  .antennas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    float: inline-start;
    margin-inline-end: 0.25rem;
    padding: 0.35rem 0;
    font-size: var(--text-secondary);
  }

  .antennas label {
    position: relative;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: var(--text-secondary);
  }

  .antennas label.chosen {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }

  .antennas label:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .antennas input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
