<!-- While measuring: the length of the path tapped so far and, from three points, the area it
     would enclose; once it has two points, how much it climbs and descends and, on asking, its
     elevation profile (ADR-0135), as a point's panel shows that of the way to it. -->
<script lang="ts">
  import { areaSquareMeters, pathMeters } from '@tesel/core';
  import type { LatLon } from '@tesel/protocol';

  import { formatArea, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { climbMetres } from '../terrain/climb.ts';
  import ClimbProfile from '../terrain/ClimbProfile.svelte';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import { WayClimb } from '../terrain/way-climb.svelte.ts';
  import ToolButton from '../ui/ToolButton.svelte';
  import ToolCard from '../ui/ToolCard.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    points: readonly LatLon[];
    onundo: () => void;
    onclose: () => void;
  }

  let { t, locale, points, onundo, onclose }: Props = $props();

  /** The profile is shown: from then on the path is read as it grows. */
  let profiled = $state(false);
  const way = new WayClimb(
    () => (points.length >= 2 ? points : null),
    () => (profiled || terrain.reader ? terrain.onDemand : null),
  );
  const length = $derived(pathMeters(points));
  /** The path as last read, while it is not being read again: never that of fewer points. */
  const read = $derived(points.length >= 2 && !way.reading ? way.current : null);
  const climb = $derived(read?.climb ?? null);
</script>

<ToolCard
  label={t('measure')}
  undo={{ label: t('undo'), disabled: points.length === 0, run: onundo }}
  closeLabel={t('close')}
  {onclose}
>
  {#snippet tools()}
    {#if terrain.onDemand}
      <ToolButton
        icon="relief"
        label={t('elevation')}
        disabled={points.length < 2}
        expanded={profiled && points.length >= 2}
        onclick={() => (profiled = !profiled)}
      />
    {/if}
  {/snippet}
  {#if points.length < 2}
    <p>{t('measureHint')}</p>
  {:else}
    <p class="measures">
      <strong>{formatDistance(length, locale)}</strong>
      {#if points.length > 2}
        · {t('measureArea', { area: formatArea(areaSquareMeters(points), locale) })}
      {/if}
      <!-- The profile says it in full under the drawing. -->
      {#if climb && !profiled}
        · {t('climbShort', { up: climbMetres(climb.up), down: climbMetres(climb.down) })}
      {/if}
    </p>
    {#if profiled}
      <ClimbProfile {t} {locale} way={read} {length} measured />
    {/if}
  {/if}
</ToolCard>

<style>
  .measures {
    font-variant-numeric: tabular-nums;
  }
</style>
