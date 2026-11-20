<!-- The panels about the map and this device, with or without a group: a point of the map, this
     device's position and the map's layers. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import { setGround } from '../map/ground.svelte.ts';
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
   * Each base map comes with what reading it asks for (ADR-0155); each can then be changed again.
   * The topographic map, its relief. The urban map, its buildings at their height, in 3D. The
   * tactical map, read as a military map is (ADR-0141, ADR-0145): the MGRS grid on, coordinates in
   * MGRS, bearings in mils from magnetic north, the radar's rings round this device (ADR-0150) and
   * the slopes a vehicle can or cannot climb.
   */
  async function withMap(base: BaseMap): Promise<void> {
    if (base === 'topo') await preferences.relief.set(true);
    if (base === 'urban') setGround(map, true);
    if (base !== 'tactical') return;
    // Asked first, within the tap, as the iPhone wants: the compass turns this device's arrow.
    const asked = compass.ask();
    await preferences.grid.set(true);
    await preferences.coordinateFormat.set('mgrs');
    await preferences.bearingUnit.set('mils');
    await preferences.north.set('magnetic');
    await preferences.radar.set(true);
    await preferences.slope.set(true);
    await asked;
  }
</script>

{#if panels.open?.name === 'point'}
  {@const { at, title: name } = panels.open}
  {@const here = weather ? warningsAt(weather.regions, at) : null}
  <PointLayer {map} point={at} />
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
      {#if weather && here && here.warnings.length > 0}
        <WarningList {t} {locale} {here} source={weather.source} />
      {/if}
    {/snippet}
  </PointPanel>
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
