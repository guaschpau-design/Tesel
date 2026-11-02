<!-- Among the map's controls: raises the ground in 3D and leans the map back to show it, or lays
     both flat again (ADR-0102). The elevation is the same as the relief's, offline too. A screen
     at rest lays it flat, to spare the battery. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Translate } from '../i18n/index.ts';
  import { activity } from '../power/activity.svelte.ts';
  import { ground, GROUND_PITCH } from './ground.svelte.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
  }

  let { t, map }: Props = $props();

  function set(raised: boolean): void {
    ground.raised = raised;
    map.easeTo({ pitch: raised ? GROUND_PITCH : 0 });
  }

  $effect(() => {
    if (activity.rest !== 'awake' && ground.raised) set(false);
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
