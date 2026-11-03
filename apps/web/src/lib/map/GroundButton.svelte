<!-- Among the map's controls: raises the ground in 3D and leans the map back to show it, or lays
     both flat again (ADR-0102, ADR-0106). The elevation is the same as the relief's, offline too;
     how high it is raised follows the zoom. A screen at rest lays it flat, to spare the battery. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Translate } from '../i18n/index.ts';
  import { activity } from '../power/activity.svelte.ts';
  import { ground, GROUND_MAX_PITCH, GROUND_PITCH, groundExaggeration } from './ground.svelte.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
  }

  let { t, map }: Props = $props();

  function set(raised: boolean): void {
    ground.raised = raised;
    if (raised) map.setMaxPitch(GROUND_MAX_PITCH);
    map.easeTo({ pitch: raised ? GROUND_PITCH : 0 });
    // Back to MapLibre's own limit once the map lies flat, so that it does not cut the ease short.
    if (!raised) {
      map.once('moveend', () => {
        if (!ground.raised) map.setMaxPitch(null);
      });
    }
  }

  $effect(() => {
    if (activity.rest !== 'awake' && ground.raised) set(false);
  });

  // Raised as the zoom asks, and again once a new style (theme, base map) has brought the
  // ground back at its own height. Only a change worth seeing is applied, so this settles.
  $effect(() => {
    const raise = () => {
      const terrain = map.getTerrain();
      if (terrain === null) return;
      const exaggeration = groundExaggeration(map.getZoom());
      if (Math.abs((terrain.exaggeration ?? 1) - exaggeration) < 0.05) return;
      map.setTerrain({ ...terrain, exaggeration });
    };
    map.on('zoom', raise);
    map.on('idle', raise);
    return () => {
      map.off('zoom', raise);
      map.off('idle', raise);
    };
  });
</script>

<button
  aria-label={t('ground3d')}
  title={t('ground3d')}
  aria-pressed={ground.raised}
  onclick={() => {
    set(!ground.raised);
  }}
>
  <span>3D</span>
</button>

<style>
  span {
    font-size: var(--text-secondary);
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  /* On the ink of the map's controls, filled in lime while raised, as the locate button. */
  button[aria-pressed='true'],
  button[aria-pressed='true']:hover {
    color: var(--on-accent);
    background: var(--signal);
  }
</style>
