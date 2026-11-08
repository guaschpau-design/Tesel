<!-- The map under everything, and what is shown on it: pictures to choose the map, then every layer
     as a tile, those of the group apart from those of the map; a tile is lit and ticked while it
     is shown, so what is on is seen at a glance. Last, the credits of the
     map's data and the licences of the third-party code the app ships, in one line of small print.
     This device and SOS calls are always shown. -->
<script lang="ts">
  import { thirdPartyNoticesUrl } from '../config.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import BaseMapPreview from './BaseMapPreview.svelte';
  import { isFlag, LAYER_GROUPS, type LayerSwitch, type MapFlag, type MapLayer } from './layers.ts';
  import { BASE_MAPS, type BaseMap } from './style/style.ts';

  interface Props {
    t: Translate;
    base: Preference<BaseMap>;
    /** The layers that are off unless turned on, each a preference. */
    flags: Readonly<Record<MapFlag, Preference<boolean>>>;
    hidden: Preference<readonly MapLayer[]>;
    /** What the map's data asks to be credited for, as HTML of our own. */
    credits: readonly string[];
    onclose: () => void;
  }

  let { t, base, flags, hidden, credits, onclose }: Props = $props();

  const BASE_NAMES: Readonly<Record<BaseMap, MessageKey>> = {
    topo: 'baseMapTopo',
    aerial: 'baseMapAerial',
    tactical: 'baseMapTactical',
  };

  function isOn(name: LayerSwitch): boolean {
    return isFlag(name) ? flags[name].value : !hidden.value.includes(name);
  }

  async function toggle(name: LayerSwitch): Promise<void> {
    if (isFlag(name)) {
      await flags[name].set(!flags[name].value);
      return;
    }
    const others = hidden.value.filter((layer) => layer !== name);
    await hidden.set(hidden.value.includes(name) ? others : [...others, name]);
  }
</script>

<Panel title={t('layers')} closeLabel={t('close')} {onclose}>
  <div class="tiles section" role="radiogroup" aria-label={t('baseMap')}>
    {#each BASE_MAPS as option (option)}
      <button
        class="base"
        role="radio"
        aria-checked={base.value === option}
        onclick={() => base.set(option)}
      >
        <BaseMapPreview base={option} />
        <span>{t(BASE_NAMES[option])}</span>
      </button>
    {/each}
  </div>
  {#each LAYER_GROUPS as group (group.label)}
    <section class="section" aria-label={t(group.label)}>
      <h3>{t(group.label)}</h3>
      <div class="tiles">
        {#each group.switches as layer (layer.name)}
          {@const on = isOn(layer.name)}
          <button
            class="layer"
            role="switch"
            aria-checked={on}
            onclick={() => void toggle(layer.name)}
          >
            {#if on}<span class="tick"><Pictogram name="check" size={14} /></span>{/if}
            <Pictogram name={layer.icon} size={20} />
            <span>{t(layer.label)}</span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
  <p class="credits section">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- the credits are constants of the app -->
    {@html credits.join(' · ')} ·
    <a href={thirdPartyNoticesUrl()} target="_blank">{t('thirdPartyLicences')}</a>
  </p>
</Panel>

<style>
  /* Three to a row: the base maps, a picture each, and the layers, a pictogram each. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .tiles button {
    display: grid;
    gap: 0.25rem;
    place-content: center;
    place-items: center;
    padding: 0.35rem 0.3rem 0.4rem;
    font-size: var(--text-small);
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
  }

  .base {
    border-width: 2px;
    border-color: transparent;
  }

  .base[aria-checked='true'] {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 1px var(--accent-line);
  }

  /* A layer that is shown is lit in the accent; one that is off fades, as a switch that is off
     does. */
  .layer {
    position: relative;
    min-height: 4rem;
  }

  h3 {
    margin: 0 0 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
  }

  /* On, a tile is ticked in its corner as well as lit: the two states differ by more than a shade. */
  .tick {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    display: grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    color: var(--surface);
    background: var(--accent-line);
    border-radius: 50%;
  }

  .layer[aria-checked='true'] {
    background: color-mix(in srgb, var(--accent) 35%, transparent);
    border-color: var(--accent-line);
  }

  .layer[aria-checked='false'] {
    color: var(--muted);
    font-weight: 400;
  }

  .layer[aria-checked='false'] :global(svg) {
    opacity: 0.45;
  }

  /* The credits are small print. */
  .credits {
    margin-bottom: 0;
    padding: 0 0.2rem;
    color: var(--muted);
    font-size: var(--text-small);
  }

  .credits :global(a) {
    color: inherit;
  }
</style>
