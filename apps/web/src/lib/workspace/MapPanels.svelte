<!-- The panels about the map and this device, with or without a group: a point of the map, finding
     a coordinate, this device's position and the map's layers. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import FindCoordinatePanel from '../coordinates/FindCoordinatePanel.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import MePanel from '../me/MePanel.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import { newTask } from '../tasks/task-editor.ts';
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
    /** Shows a coordinate found: its point, on the map. */
    onfind: (at: LatLon) => void;
    /** Starts a marker at a point of the group's map. */
    onmark: (at: LatLon) => void;
  }

  let { t, locale, map, group, selfName, preferences, weather, credits, onfind, onmark }: Props =
    $props();
</script>

{#if panels.open?.name === 'point'}
  {@const { at, title: name } = panels.open}
  {@const here = weather ? warningsAt(weather.regions, at) : null}
  <PointLayer {map} point={at} />
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
    onclose={closePanel}
  >
    {#snippet about()}
      {#if weather && here && here.warnings.length > 0}
        <WarningList {t} {locale} {here} source={weather.source} />
      {/if}
    {/snippet}
  </PointPanel>
{:else if isOpen('find')}
  <FindCoordinatePanel {t} {onfind} onclose={closePanel} />
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
    }}
    hidden={preferences.hiddenLayers}
    {credits}
    onclose={closePanel}
  />
{/if}
