<!--
  Everything on top of the map: the cadastre, weather warnings, the MGRS grid, the radar, public
  services, this device, the group's members, objects, tasks and incidents, drawing, measuring and
  navigating, the panels and the dock. Without an active group, only what works alone: the
  cadastre, weather warnings, the grid, the radar's rings, services, this device, coordinates,
  measuring, navigating to a point and offline maps.
-->
<script lang="ts">
  import { EMPTY_STATE } from '@tesel/core';
  import { eventRefKey, type LatLon, type NodeId, type Place } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount, untrack } from 'svelte';

  import { CADASTRE_CREDITS } from '../cadastre/cadastre.ts';
  import CadastreLayer from '../cadastre/CadastreLayer.svelte';
  import MgrsGridLayer from '../coordinates/MgrsGridLayer.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import SosCall from '../incidents/SosCall.svelte';
  import SosLayer from '../incidents/SosLayer.svelte';
  import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
  import { showPoint } from '../map/geometry.ts';
  import { onLongPress } from '../map/long-press.ts';
  import { useStyleCredits } from '../map/style/style-credits.svelte.ts';
  import { groupPoints, StartFraming } from '../map/start-framing.ts';
  import { MapTaps } from '../map/taps.ts';
  import CompassButton from '../map/CompassButton.svelte';
  import MapControl from '../map/MapControl.svelte';
  import MapCredits from '../map/MapCredits.svelte';
  import MapScale from '../map/MapScale.svelte';
  import MemberLayer from '../members/MemberLayer.svelte';
  import TrailLayer from '../members/TrailLayer.svelte';
  import { navigation } from '../navigation/navigation.svelte.ts';
  import { DRAFT_NAMES, draftGeometry, type DraftKind } from '../objects/draft.ts';
  import { Drawing } from '../objects/drawing.svelte.ts';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import { operationAreas } from '../objects/operation-areas.ts';
  import { useSweepCompletion } from '../objects/sweep-completion.svelte.ts';
  import { useSelfState } from '../me/self-state.svelte.ts';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import LocateButton from '../position/LocateButton.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import SosAlarm from '../incidents/SosAlarm.svelte';
  import { radio } from '../radio/radio.svelte.ts';
  import ReportLayer from '../reports/ReportLayer.svelte';
  import type { TappedService } from '../services/services.ts';
  import ServicesLayer from '../services/ServicesLayer.svelte';
  import RadarLayer from '../radar/RadarLayer.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import { storageRefusals } from '../storage/storage-space.svelte.ts';
  import { noticeSent } from '../sync/sent-notice.ts';
  import MapTasks from '../tasks/MapTasks.svelte';
  import { myPendingCount, placePoint, type TaskEditing } from '../tasks/tasks.ts';
  import ChatNotice from '../chat/ChatNotice.svelte';
  import { fromOthers } from '../chat/unread.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { deviceClock } from '../sync/device-clock.svelte.ts';
  import { useStandingNotice } from '../ui/notices.svelte.ts';
  import { closePanel, isOpen, openPanel, togglePanel } from '../ui/panels.svelte.ts';
  import { keepScreenAwake } from '../ui/screen-awake.svelte.ts';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import WeatherLayer from '../weather/WeatherLayer.svelte';
  import Dock from './Dock.svelte';
  import GroupNews from '../groups/GroupNews.svelte';
  import GroupPanels from './GroupPanels.svelte';
  import MapPanels from './MapPanels.svelte';
  import MapStatus from './MapStatus.svelte';
  import { stateSlices } from './state-slices.svelte.ts';
  import type { MapTool, SelfName, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The map opened on its wide view, not on one the address gave: it frames the group. */
    mapOpenedWide: boolean;
    /** The active group and this device's place in it, when there is an active group. */
    group: WorkspaceGroup | null;
    /** This device is in no group: the ways to start are offered on the map. */
    groupless: boolean;
    /** The name this device goes by, once it has one. */
    selfName: SelfName | null;
    preferences: Preferences;
    /** Downloaded maps: the operation area is offered for download. */
    offline: OfflineMaps;
    /** Official weather warnings, when the app's server publishes them. */
    weather: WeatherFeed | null;
    onendpractice: () => void;
  }

  let {
    t,
    locale,
    map,
    mapOpenedWide,
    group,
    groupless,
    selfName,
    preferences,
    offline,
    weather,
    onendpractice,
  }: Props = $props();

  // Kept on when the user asks, and always while guiding to a target.
  // A phone that carries the radio for the group must not sleep: with the screen off the browser
  // stops it, and with it the bridge between the radio and the server.
  keepScreenAwake(
    () => preferences.keepScreenOn.value || navigation.target !== null || radio.linked,
  );

  const drawing = new Drawing();
  let tool: MapTool | null = $state.raw(null);
  /** Drawing or a tool: taps on the map add points instead of opening what they hit. */
  const drawingOrMeasuring = $derived(drawing.draft !== null || tool !== null);
  /** Every tap on the map goes to one owner: the tool in use, or what is drawn on top. */
  const taps = new MapTaps(() => !drawingOrMeasuring);
  /** The group's state slice by slice: each layer redraws only when its own slices change. */
  const slices = stateSlices(() => group?.feed.state ?? EMPTY_STATE);
  /** Which map layers are shown, by layer. */
  const shown = $derived(
    Object.fromEntries(
      MAP_LAYERS.map((layer) => [layer, !preferences.hiddenLayers.value.includes(layer)]),
    ) as Record<MapLayer, boolean>,
  );
  /** What the map's data asks to be credited for, with the cadastres when they are shown. */
  const styleCredits = useStyleCredits(() => map);
  const credits = $derived(
    preferences.cadastre.value ? [...styleCredits.list, ...CADASTRE_CREDITS] : styleCredits.list,
  );
  let sosOpen = $state(false);

  useStandingNotice(() => (radio.reconnecting ? { text: t('radioReconnecting') } : null));
  useSweepCompletion(() => group);
  useSelfState(
    () => group?.feed ?? null,
    () => preferences,
  );

  useStandingNotice(() => {
    const minutes = deviceClock.wrongByMinutes;
    if (minutes === null) return null;
    return { text: t(minutes > 0 ? 'clockAhead' : 'clockBehind', { minutes: Math.abs(minutes) }) };
  });

  useStandingNotice(() => {
    if (deviceLocation.problem === null) return null;
    return {
      text: deviceLocation.problem === 'denied' ? t('locationDenied') : t('locationUnavailable'),
    };
  });

  /** Chat lines and reports of others in the group, and how many of them are new here. */
  const chatFromOthers = $derived(group ? fromOthers(group.feed.state, group.self) : 0);
  const chatUnread = $derived(group ? Math.max(0, chatFromOthers - group.feed.chatSeen) : 0);

  // While the chat is open, what arrives in it is seen.
  $effect(() => {
    if (group === null || !isOpen('chat')) return;
    const { feed } = group;
    const seen = chatFromOthers;
    untrack(() => feed.markChatSeen(seen)).catch((error: unknown) => {
      storageRefusals.note(error);
      console.warn('Keeping what the chat has shown failed', error);
    });
  });

  function startDrawing(kind: DraftKind): void {
    closePanel();
    tool = null;
    drawing.start(kind);
  }

  /** Starts a marker at a point and goes straight to describing it. */
  function markAt(at: LatLon): void {
    startDrawing('marker');
    drawing.add(at);
  }

  function inspect(at: LatLon, name = t('mapPoint')): void {
    openPanel({ name: 'point', at, title: name });
  }

  /** A service of the base map tapped: its point, under its name or its kind. */
  function inspectService(service: TappedService): void {
    inspect(service.at, service.name ?? t(service.kind.label));
  }

  /** A coordinate typed in the panel: shown on the map. */
  function find(at: LatLon): void {
    inspect(at);
    showPoint(map, at);
  }

  /** A task's place: a point shows as any point; an object, with its own panel. */
  function showPlace(place: Place): void {
    if (place.kind === 'point') {
      find(place.at);
      return;
    }
    const at = placePoint(place, slices.objects);
    if (at === null) return;
    openPanel({ name: 'object', key: eventRefKey(place.object) });
    showPoint(map, at);
  }

  onMount(() => taps.listen(map));

  // Until the user chooses a view, the map follows who appears: this device, the members.
  $effect(() => {
    const framing = new StartFraming(
      map,
      untrack(() => mapOpenedWide),
    );
    $effect(() => {
      const fix = deviceLocation.fix?.at ?? null;
      const areas = operationAreas(slices).map((area) => area.bounds);
      const now = Date.now() / 1000;
      framing.show(groupPoints(slices.positions, group?.self ?? null, fix, now, areas));
    });
    return () => {
      framing.remove();
    };
  });

  onMount(() =>
    onLongPress(map, (at) => {
      if (!drawingOrMeasuring) inspect(at);
    }),
  );

  async function saveDraft(code: number, label: string): Promise<void> {
    const { draft } = drawing;
    if (draft === null || group === null) return;
    const [first] = draft.points;
    const geometry = draftGeometry(draft);
    if (draft.kind === 'marker' && first) await group.feed.placeMarker(first, code, label);
    else if (geometry) await group.feed.drawShape(geometry, code, label);
    drawing.stop();
    noticeSent(t, group.feed, t(DRAFT_NAMES[draft.kind]));
  }

  function select(key: string): void {
    openPanel({ name: 'object', key });
  }

  function selectMember(member: NodeId): void {
    openPanel({ name: 'member', member });
  }

  function startTool(next: MapTool): void {
    closePanel();
    drawing.stop();
    tool = next;
  }
</script>

{#if preferences.cadastre.value}
  <CadastreLayer {map} />
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
  {@const { feed, self, role } = group}
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
    {#if role === 'coordinator'}
      <GroupNews {t} {locale} state={slices} {self} />
    {/if}
    <ChatNotice {t} chat={slices.chat} members={slices.members} {self} open={isOpen('chat')} />
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

  {#if drawing.draft && drawing.describing}
    <ObjectForm
      {t}
      kind={drawing.draft.kind}
      label={drawing.imported?.name ?? ''}
      coordinator={role === 'coordinator'}
      onsave={saveDraft}
      oncancel={() => {
        drawing.stop();
      }}
    />
  {/if}

  <GroupPanels
    {t}
    {locale}
    {feed}
    {self}
    {role}
    {preferences}
    onplace={showPlace}
    onplansweep={(area: string) => {
      startTool({ kind: 'sweep', area });
    }}
    onpicktaskplace={(editing: TaskEditing) => {
      startTool({ kind: 'task-place', editing });
    }}
  />

  {#key feed}
    <SosCall {t} {group} open={sosOpen} onclose={() => (sosOpen = false)} />
  {/key}
{/if}

<MapPanels
  {t}
  {locale}
  {map}
  {group}
  {selfName}
  {preferences}
  weather={shown.weather ? weather : null}
  {credits}
  onfind={find}
  onmark={markAt}
/>
<SelfLayer {map} />

{#if group}
  <SosAlarm
    {t}
    groupState={group.feed.state}
    self={group.self}
    choices={{
      sound: preferences.alarmSound.value,
      notifications: preferences.notifications.value,
    }}
    oninterrupt={() => {
      // The chat fills the screen, over the incidents' cards; other panels leave them in view.
      if (isOpen('chat')) closePanel();
    }}
  />
{/if}
<MapStatus
  {t}
  {locale}
  {map}
  {taps}
  {group}
  {slices}
  {drawing}
  {tool}
  {drawingOrMeasuring}
  weather={shown.weather ? weather : null}
  {offline}
  onclosetool={() => (tool = null)}
  {onendpractice}
  dutyActive={preferences.dutyStatus.value === 'active'}
  {groupless}
/>
<MapControl {map}>
  <CompassButton {t} {map} />
  <LocateButton {t} {map} />
  <button
    aria-label={t('layers')}
    title={t('layers')}
    aria-expanded={isOpen('layers')}
    onclick={() => {
      togglePanel('layers');
    }}
  >
    <Pictogram name="layers" size={18} />
  </button>
</MapControl>
<MapScale {map} />
<!-- Shown again with each base map, which brings its own sources. -->
{#key preferences.baseMap.value}
  <MapCredits {map} {credits} />
{/key}

<Dock
  {t}
  sharing={group?.sharing ?? null}
  onsos={() => (sosOpen = true)}
  ondraw={startDrawing}
  onmeasure={() => {
    startTool({ kind: 'measure' });
  }}
  tasksForMe={group ? myPendingCount(group.feed.state, group.self) : 0}
  {chatUnread}
  {drawingOrMeasuring}
/>
