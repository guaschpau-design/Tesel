<!--
  The layers of the map: the cadastre, fires and flood zones, the MGRS grid, the radar, weather
  warnings and public services, then the active group's trails, objects, tasks, reports, members
  and SOS calls. A tap on a service, an object or a member opens its panel.
-->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { CADASTRE_MIN_ZOOM, CADASTRES } from '../cadastre/cadastre.ts';
  import { defaultServerUrl } from '../config.ts';
  import { FIRES, FIRES_MIN_ZOOM, floodServices, FLOODS_MIN_ZOOM } from '../hazards/hazards.ts';
  import MgrsGridLayer from '../coordinates/MgrsGridLayer.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import SosLayer from '../incidents/SosLayer.svelte';
  import type { MapLayer } from '../map/layers.ts';
  import type { MapTaps } from '../map/taps.ts';
  import MemberLayer from '../members/MemberLayer.svelte';
  import TrailLayer from '../members/TrailLayer.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import RadarLayer from '../radar/RadarLayer.svelte';
  import ViewPictureLayer from '../map/wms/ViewPictureLayer.svelte';
  import ReportLayer from '../reports/ReportLayer.svelte';
  import type { TappedService } from '../services/services.ts';
  import ServicesLayer from '../services/ServicesLayer.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import MapTasks from '../tasks/MapTasks.svelte';
  import { openPanel } from '../ui/panels.svelte.ts';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import WeatherLayer from '../weather/WeatherLayer.svelte';
  import type { WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    taps: MapTaps;
    group: WorkspaceGroup | null;
    /** The group's state slice by slice (state-slices.svelte.ts), empty without a group. */
    slices: GroupState;
    /** Which of the layers the user can hide are shown. */
    shown: Record<MapLayer, boolean>;
    preferences: Preferences;
    /** Official weather warnings, when the app's server publishes them. */
    weather: WeatherFeed | null;
  }

  let { t, locale, map, taps, group, slices, shown, preferences, weather }: Props = $props();

  /** A service of the base map tapped: its point, under its name or its kind. */
  function inspectService(service: TappedService): void {
    openPanel({ name: 'point', at: service.at, title: service.name ?? t(service.kind.label) });
  }

  function select(key: string): void {
    openPanel({ name: 'object', key });
  }

  function selectMember(member: NodeId): void {
    openPanel({ name: 'member', member });
  }
</script>

{#if preferences.cadastre.value}
  <ViewPictureLayer
    {map}
    level="cadastre"
    services={CADASTRES}
    minZoom={CADASTRE_MIN_ZOOM}
    opacity={0.9}
  />
{/if}
{#if preferences.floods.value}
  <ViewPictureLayer
    {map}
    level="hazards"
    services={floodServices(defaultServerUrl())}
    minZoom={FLOODS_MIN_ZOOM}
    opacity={0.6}
  />
{/if}
{#if preferences.fires.value}
  <ViewPictureLayer {map} level="hazards" services={FIRES} minZoom={FIRES_MIN_ZOOM} opacity={1} />
{/if}
{#if preferences.grid.value}
  <MgrsGridLayer {map} />
{/if}
{#if preferences.radar.value}
  <RadarLayer
    {map}
    {locale}
    group={group ? { positions: slices.positions, self: group.self } : null}
  />
{/if}
{#if weather}
  <WeatherLayer {map} regions={weather.regions} visible={shown.weather} />
{/if}
<ServicesLayer {map} {taps} {locale} visible={shown.services} onselect={inspectService} />

{#if group}
  {@const { feed, self } = group}
  <TrailLayer {map} trails={slices.trails} {self} visible={shown.trails} />
  <ObjectLayer
    {map}
    {taps}
    objects={slices.objects}
    tasks={slices.tasks}
    teams={slices.teams}
    visible={shown.objects}
    onselect={select}
  />
  <!-- What a group held when it opened is not news: the tasks' notices start again with each. -->
  {#key feed}
    <MapTasks
      {t}
      {map}
      {taps}
      tasks={slices.tasks}
      objects={slices.objects}
      members={slices.members}
      teams={slices.teams}
      {self}
      visible={shown.tasks}
    />
  {/key}
  <ReportLayer
    {t}
    {map}
    {taps}
    reports={slices.reports}
    objects={slices.objects}
    visible={shown.reports}
  />
  <MemberLayer
    {map}
    {taps}
    positions={slices.positions}
    members={slices.members}
    memberStates={slices.memberStates}
    teams={slices.teams}
    sos={slices.sos}
    sosCancels={slices.sosCancels}
    {self}
    visible={shown.members}
    onselect={selectMember}
  />
  <SosLayer
    {map}
    sos={slices.sos}
    sosCancels={slices.sosCancels}
    members={slices.members}
    positions={slices.positions}
  />
{/if}
