<!--
  Everything on top of the map: the cadastre, weather warnings, the MGRS grid, the radar, public
  services, this device, the group's members, objects, tasks and incidents, drawing, measuring and
  navigating, the panels and the dock. Without an active group, only what works alone: the
  cadastre, weather warnings, the grid, the radar's rings, services, this device, coordinates,
  measuring, navigating to a point and offline maps. The layers are in MapLayers.svelte, drawing
  and the tools in map-tools.svelte.ts.
-->
<script lang="ts">
  import { EMPTY_STATE } from '@tesel/core';
  import { eventRefKey, type LatLon, type Place } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount, untrack } from 'svelte';

  import { CADASTRE_CREDITS } from '../cadastre/cadastre.ts';
  import ChatNotice from '../chat/ChatNotice.svelte';
  import { useChatUnread } from '../chat/chat-unread.svelte.ts';
  import GroupNews from '../groups/GroupNews.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import SosAlarm from '../incidents/SosAlarm.svelte';
  import SosCall from '../incidents/SosCall.svelte';
  import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
  import { showPoint } from '../map/geometry.ts';
  import { useStyleCredits } from '../map/style/style-credits.svelte.ts';
  import { groupPoints, StartFraming } from '../map/start-framing.ts';
  import { MapTaps } from '../map/taps.ts';
  import CompassButton from '../map/CompassButton.svelte';
  import MapControl from '../map/MapControl.svelte';
  import MapCredits from '../map/MapCredits.svelte';
  import MapScale from '../map/MapScale.svelte';
  import { navigation } from '../navigation/navigation.svelte.ts';
  import { DRAFT_NAMES, draftGeometry } from '../objects/draft.ts';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import { operationAreas } from '../objects/operation-areas.ts';
  import { useSweepCompletion } from '../objects/sweep-completion.svelte.ts';
  import { useSelfState } from '../me/self-state.svelte.ts';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import LocateButton from '../position/LocateButton.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import { radio } from '../radio/radio.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import { noticeSent } from '../sync/sent-notice.ts';
  import { myPendingCount, placePoint, type TaskEditing } from '../tasks/tasks.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { closePanel, isOpen, openPanel, panels, togglePanel } from '../ui/panels.svelte.ts';
  import { keepScreenAwake } from '../ui/screen-awake.svelte.ts';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import { useDeviceNotices } from './device-notices.svelte.ts';
  import Dock from './Dock.svelte';
  import GroupPanels from './GroupPanels.svelte';
  import MapLayers from './MapLayers.svelte';
  import MapPanels from './MapPanels.svelte';
  import MapStatus from './MapStatus.svelte';
  import { useMapTools } from './map-tools.svelte.ts';
  import { stateSlices } from './state-slices.svelte.ts';
  import type { SelfName, WorkspaceGroup } from './workspace.ts';

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
  }: Props = $props();

  // Kept on when the user asks, and always while guiding to a target.
  // A phone that carries the radio for the group must not sleep: with the screen off the browser
  // stops it, and with it the bridge between the radio and the server.
  keepScreenAwake(
    () => preferences.keepScreenOn.value || navigation.target !== null || radio.linked,
  );

  const tools = useMapTools(() => group?.feed.groupId ?? null);
  const { drawing } = tools;
  /** Every tap on the map goes to one owner: the tool in use, or what is drawn on top. */
  const taps = new MapTaps(() => !tools.drawingOrMeasuring);
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

  useDeviceNotices(() => t);
  useSweepCompletion(() => group);
  useSelfState(
    () => group?.feed ?? null,
    () => preferences,
  );
  const chatUnread = useChatUnread(() => group);

  function inspect(at: LatLon): void {
    openPanel({ name: 'point', at, title: t('mapPoint') });
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

  // A tap on an empty part of the map closes what is open, as people expect; with nothing open,
  // it shows that point: how far it is, the way there, and what can be done there.
  onMount(() =>
    taps.onPlace((at) => {
      if (panels.open === null) inspect(at);
      else closePanel();
    }),
  );

  async function saveDraft(code: number, label: string): Promise<void> {
    const { draft } = drawing;
    if (draft === null || group === null) return;
    const [first] = draft.points;
    const geometry = draftGeometry(draft);
    if (draft.kind === 'marker' && first) await group.feed.placeMarker(first, code, label);
    else if (geometry) await group.feed.drawShape(geometry, code, label);
    else return;
    drawing.stop();
    noticeSent(t, group.feed, t(DRAFT_NAMES[draft.kind]));
  }
</script>

<MapLayers {t} {locale} {map} {taps} {group} {slices} {shown} {preferences} {weather} />

{#if group}
  {@const { feed, self, role } = group}
  {#key feed}
    {#if role === 'coordinator'}
      <GroupNews {t} {locale} state={slices} {self} />
    {/if}
    <ChatNotice {t} chat={slices.chat} members={slices.members} {self} open={isOpen('chat')} />
  {/key}

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
      tools.startTool({ kind: 'sweep', area });
    }}
    onpicktaskplace={(editing: TaskEditing) => {
      tools.startTool({ kind: 'task-place', editing });
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
  onmark={tools.markAt}
/>
<SelfLayer {map} label={t('youOnMap')} />

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
  tool={tools.tool}
  drawingOrMeasuring={tools.drawingOrMeasuring}
  weather={shown.weather ? weather : null}
  {offline}
  onclosetool={tools.closeTool}
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
  ondraw={tools.startDrawing}
  onmeasure={() => {
    tools.startTool({ kind: 'measure' });
  }}
  tasksForMe={group ? myPendingCount(group.feed.state, group.self) : 0}
  chatUnread={chatUnread.count}
  drawingOrMeasuring={tools.drawingOrMeasuring}
/>
