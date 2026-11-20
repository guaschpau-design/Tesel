<!-- The panels about the map and this device, with or without a group: a point of the map or a
     building, the light of the day, this device's position and the map's layers. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import BuildingCard from '../buildings/BuildingCard.svelte';
  import BuildingOutline from '../buildings/BuildingOutline.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import LightPanel from '../daylight/LightPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import { setGround } from '../map/ground.svelte.ts';
  import { MAP_FLAGS } from '../map/layers.ts';
  import { mapDefaults } from '../map/map-defaults.ts';
  import type { BaseMap } from '../map/style/style.ts';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import { compass } from '../position/compass.svelte.ts';
  import MePanel from '../me/MePanel.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import { newTask } from '../tasks/task-editor.ts';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import type { ViewshedState } from '../terrain/viewshed.ts';
  import ViewshedLayer from '../terrain/ViewshedLayer.svelte';
  import { closePanel, isOpen, panels } from '../ui/panels.svelte.ts';
  import WarningList from '../weather/WarningList.svelte';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import { warningsAt } from '../weather/weather-warnings.ts';
  import type { SelfName, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    group: WorkspaceGroup | null;
    selfName: SelfName | null;
    preferences: Preferences;
    /** Weather warnings, while their layer is shown: a point tells those in force there. */
    weather: WeatherFeed | null;
    /** What the map's data asks to be credited for, listed in the layers panel. */
    credits: readonly string[];
    /** Starts a marker at a point of the group's map. */
    onmark: (at: LatLon) => void;
  }

  let { t, locale, map, group, selfName, preferences, weather, credits, onmark }: Props = $props();

  /** The point whose view is shown (ADR-0152): only while its panel is open. */
  let viewFrom: LatLon | null = $state.raw(null);
  let viewState: Exclude<ViewshedState, 'off'> = $state('working');
  const pointAt = $derived(panels.open?.name === 'point' ? panels.open.at : null);
  const viewshed: ViewshedState = $derived(
    viewFrom !== null && viewFrom === pointAt ? viewState : 'off',
  );

  /**
   * Each base map comes with what reading it asks for (ADR-0155, ADR-0160); each can then be
   * changed again: its own layers on or off (map/map-defaults.ts), bearings and coordinates read
   * as on a military map on the tactical map (ADR-0141, ADR-0145) and as on any map elsewhere, and
   * the urban map's buildings at their height, in 3D.
   */
  async function withMap(base: BaseMap): Promise<void> {
    // Asked first, within the tap, as the iPhone wants: the compass turns this device's arrow.
    const asked = base === 'tactical' ? compass.ask() : Promise.resolve();
    if (base === 'urban') setGround(map, true);
    const defaults = mapDefaults(base);
    // All at once: each takes effect as it is set, and storing them waits on a busy map.
    await Promise.all([
      ...MAP_FLAGS.map((flag) => preferences[flag].set(defaults.flags[flag])),
      preferences.hiddenLayers.set(defaults.hidden(preferences.hiddenLayers.value)),
      preferences.bearingUnit.set(defaults.bearingUnit),
      preferences.north.set(defaults.north),
      preferences.coordinateFormat.set(defaults.coordinates(preferences.coordinateFormat.value)),
    ]);
    await asked;
  }
</script>

{#if panels.open?.name === 'point'}
  {@const { at, title: name, building } = panels.open}
  {@const here = weather ? warningsAt(weather.regions, at) : null}
  {#if building}
    <BuildingOutline {map} {building} />
  {:else}
    <PointLayer {map} point={at} />
  {/if}
  {#if viewshed !== 'off' && terrain.onDemand}
    <ViewshedLayer
      {map}
      from={at}
      heights={terrain.onDemand}
      onstate={(state: Exclude<ViewshedState, 'off'>) => {
        viewState = state;
      }}
    />
  {/if}
  <PointPanel
    {t}
    {locale}
    title={name}
    {at}
    format={preferences.coordinateFormat}
    base={preferences.baseMap.value}
    onnavigate={() => {
      navigateTo({ kind: 'point', at, name });
    }}
    onmark={group
      ? () => {
          onmark(at);
        }
      : null}
    ontask={group
      ? () => {
          newTask({ kind: 'point', at });
        }
      : null}
    {viewshed}
    onviewshed={terrain.onDemand
      ? () => {
          viewFrom = viewshed === 'off' ? at : null;
        }
      : null}
    onclose={closePanel}
  >
    {#snippet about()}
      {#if building}
        <BuildingCard {t} {locale} {building} />
      {/if}
      {#if weather && here && here.warnings.length > 0}
        <WarningList {t} {locale} {here} source={weather.source} />
      {/if}
    {/snippet}
  </PointPanel>
{:else if panels.open?.name === 'light'}
  <LightPanel {t} {locale} at={panels.open.at} onclose={closePanel} />
{:else if isOpen('me')}
  <MePanel
    {t}
    {locale}
    name={selfName}
    {preferences}
    group={group && { state: group.feed.state, self: group.self, sharing: group.sharing }}
    onclose={closePanel}
  />
{:else if isOpen('layers')}
  <LayersPanel
    {t}
    base={preferences.baseMap}
    flags={{
      relief: preferences.relief,
      cadastre: preferences.cadastre,
      fires: preferences.fires,
      floods: preferences.floods,
      grid: preferences.grid,
      radar: preferences.radar,
      slope: preferences.slope,
    }}
    hidden={preferences.hiddenLayers}
    declutter={preferences.declutter}
    {credits}
    onchoose={withMap}
    onclose={closePanel}
  />
{/if}
