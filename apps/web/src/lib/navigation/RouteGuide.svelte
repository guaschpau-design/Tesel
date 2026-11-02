<!-- Guidance along a route: to its start, then point by point to its end, how much is left, and a
     warning when this device strays. At the end, a task of this device along the route can be
     marked done. -->
<script lang="ts">
  import type { LatLon, TaskEvent } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { DeviceFix } from '../position/device-location.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';
  import type { Leg } from './leg.ts';
  import NavigationBar from './NavigationBar.svelte';
  import NavigationLayer from './NavigationLayer.svelte';
  import { RouteTracker } from './route.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    name: string;
    points: readonly LatLon[];
    fix: DeviceFix | null;
    /** How much of a strip of a sweep this device has swept, 0–1; null for other routes. */
    swept: number | null;
    /** This device's task along the route, if it has one still to do. */
    task: TaskEvent | null;
    /** Marks the task done. */
    onfinishtask: (task: TaskEvent) => Promise<void>;
    onstop: () => void;
  }

  let { t, locale, map, name, points, fix, swept, task, onfinishtask, onstop }: Props = $props();

  const tracker = $derived(new RouteTracker(points));
  // Each position moves the tracker on; progress never goes back.
  const progress = $derived(fix && tracker.update(fix.at, fix.accuracy));
  const leg = $derived(progress && progress.stage !== 'arrived' ? progress.leg : null);

  function way(of: Leg): string {
    return `${formatDistance(of.metres, locale)} · ${formatBearing(of.bearing, locale)}`;
  }
</script>

<NavigationLayer
  {map}
  from={fix?.at ?? null}
  to={progress && progress.stage !== 'arrived' ? progress.to : null}
/>
<NavigationBar
  {t}
  {map}
  title={t('followingRoute', { name })}
  {leg}
  edge={progress?.stage === 'off-route' ? 'var(--warning)' : undefined}
  {onstop}
>
  {#if progress === null}
    <p>{t('navigationWaitingFix')}</p>
  {:else if progress.stage === 'to-start'}
    <p>{t('routeToStart')}: <strong>{way(progress.leg)}</strong></p>
  {:else if progress.stage === 'on-route'}
    <p>
      <strong>{t('routeLeft', { distance: formatDistance(progress.remaining, locale) })}</strong>
    </p>
    <p>
      {t('routeNextPoint', { number: progress.next + 1, total: points.length })}: {way(
        progress.leg,
      )}
    </p>
  {:else if progress.stage === 'off-route'}
    <p><strong>{t('routeOff')}</strong></p>
    <p>{t('routeBack')}: {way(progress.leg)}</p>
  {:else}
    <p>{t('routeArrived')}</p>
  {/if}
  {#if swept !== null}
    <p class="swept">
      <span class="bar"><span style:width="{swept * 100}%"></span></span>
      {t('sweptPercent', { percent: Math.round(swept * 100) })}
    </p>
  {/if}
  {#snippet actions()}
    {#if task && progress?.stage === 'arrived'}
      {@const done = task}
      <button
        class="primary"
        onclick={() => {
          attempt(async () => {
            await onfinishtask(done);
            onstop();
          }, t('actionFailed'));
        }}>{t('routeTaskDone')}</button
      >
    {/if}
  {/snippet}
</NavigationBar>

<style>
  .swept {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .bar {
    flex: 1;
    max-width: 8rem;
    height: 0.4rem;
    overflow: hidden;
    background: var(--border);
    border-radius: var(--radius-pill);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent-line);
  }
</style>
