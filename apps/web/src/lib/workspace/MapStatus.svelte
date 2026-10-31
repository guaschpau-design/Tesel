<!-- The top of the map, in order of what needs attention first: the tool in use (drawing,
     measuring), the incidents, a danger area entered, guidance, a practice, whether the group sees
     this device, weather where this device is, the operation area's map, then the app's notices. The stack never runs under the
     dock: past its height it scrolls. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { EventRef, LatLon, NodeId, TaskEvent } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { callForHelp } from '../incidents/call-for-help.ts';
  import StartCard from '../groups/StartCard.svelte';
  import SosBanners from '../incidents/SosBanners.svelte';
  import CheckInCard from '../me/CheckInCard.svelte';
  import { mapCentre, showPoint, showPoints } from '../map/geometry.ts';
  import type { MapTaps } from '../map/taps.ts';
  import Measuring from '../measure/Measuring.svelte';
  import Navigation from '../navigation/Navigation.svelte';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import DangerZoneAlert from '../objects/DangerZoneAlert.svelte';
  import DrawBar from '../objects/DrawBar.svelte';
  import type { Drawing } from '../objects/drawing.svelte.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import { objectTitle } from '../objects/object-names.ts';
  import type { ImportedShape } from '../objects/shape-import.ts';
  import { planSweep, type SweepRecipe } from '../objects/sweep-actions.ts';
  import SweepPlanner from '../objects/SweepPlanner.svelte';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import OperationAreaOffer from '../offline/OperationAreaOffer.svelte';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import SharePrompt from '../position/SharePrompt.svelte';
  import Practice from '../practice/Practice.svelte';
  import TaskPlacePicker from '../tasks/TaskPlacePicker.svelte';
  import { saveTask } from '../tasks/task-actions.ts';
  import { fieldsOf } from '../tasks/tasks.ts';
  import Notices from '../ui/Notices.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import WeatherCard from '../weather/WeatherCard.svelte';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import type { MapTool, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    taps: MapTaps;
    group: WorkspaceGroup | null;
    /** The group's state slice by slice (state-slices.svelte.ts), empty without a group. */
    slices: GroupState;
    drawing: Drawing;
    tool: MapTool | null;
    /** Drawing or a tool takes taps on the map: incidents and offers wait. */
    drawingOrMeasuring: boolean;
    /** Weather warnings, while their layer is shown. */
    weather: WeatherFeed | null;
    offline: OfflineMaps;
    onclosetool: () => void;
    onendpractice: () => void;
    /** This member is active: only then does the safety check-in ask (protocol §3.17). */
    dutyActive: boolean;
    /** This device is in no group: the ways to start are offered. */
    groupless: boolean;
  }

  let {
    t,
    locale,
    map,
    taps,
    group,
    slices,
    drawing,
    tool,
    drawingOrMeasuring,
    weather,
    offline,
    onclosetool,
    dutyActive,
    groupless,
    onendpractice,
  }: Props = $props();

  function acknowledge(target: EventRef): void {
    const feed = group?.feed;
    if (feed) attempt(() => feed.acknowledge(target), t('actionFailed'));
  }

  function cancelSos(sos: EventRef): void {
    const feed = group?.feed;
    if (feed) attempt(() => feed.cancelSos(sos), t('actionFailed'));
  }
</script>

<div class="top">
  {#if drawing.draft && drawing.placingPoints}
    <DrawLayer
      {map}
      {taps}
      points={drawing.draft.points}
      closed={drawing.draft.kind === 'area'}
      onpoint={(at: LatLon) => {
        drawing.add(at);
      }}
    />
    <DrawBar
      {t}
      {locale}
      draft={drawing.draft}
      imported={drawing.imported}
      onpoint={(at: LatLon) => {
        drawing.add(at);
        showPoint(map, at);
      }}
      onundo={() => {
        drawing.undo();
      }}
      onfinish={() => {
        drawing.finish();
      }}
      onimport={(shape: ImportedShape) => {
        drawing.load(shape);
        showPoints(map, shape.points);
      }}
      oncancel={() => {
        drawing.stop();
      }}
    />
  {:else if tool?.kind === 'measure'}
    <Measuring {t} {locale} {map} {taps} onclose={onclosetool} />
  {:else if tool?.kind === 'task-place'}
    <TaskPlacePicker {t} {taps} editing={tool.editing} onclose={onclosetool} />
  {:else if tool?.kind === 'sweep' && group}
    {@const { feed } = group}
    <SweepPlanner
      {t}
      {locale}
      {map}
      groupState={feed.state}
      self={group.self}
      areaKey={tool.area}
      onplan={async (recipe: SweepRecipe, teams: readonly (NodeId | null)[]) => {
        const area = feed.state.objects.get(tool.area);
        if (area?.type !== 'shape') return;
        await planSweep(feed, area, recipe, teams, (strip) =>
          t('stripName', {
            area: objectTitle(area, feed.state.objects, t),
            strip: strip + 1,
            strips: teams.length,
          }),
        );
      }}
      onclose={onclosetool}
    />
  {/if}
  <!-- While a drawing or a measure takes the taps, the cards in "aside" step out of the way. They
       stay mounted, so what they hold lasts: the cards a member closed, a download under way. -->
  <div class="aside" hidden={drawingOrMeasuring}>
    {#if group}
      <SosBanners
        {t}
        {locale}
        groupState={group.feed.state}
        self={group.self}
        canCancelOthers={group.role === 'coordinator'}
        undelivered={group.feed.undelivered}
        onacknowledge={acknowledge}
        oncancel={cancelSos}
        onshow={(at: LatLon) => {
          showPoint(map, at);
        }}
        onguide={(at: LatLon, name: string) => {
          navigateTo({ kind: 'point', at, name });
        }}
      />
    {:else if groupless}
      <StartCard {t} />
    {/if}
  </div>
  {#if group}
    <DangerZoneAlert {t} groupState={group.feed.state} />
    {@const checkIn = group.feed.state.checkIn}
    {#if checkIn && checkIn.minutes > 0 && dutyActive}
      {@const { feed } = group}
      {#key feed}
        <CheckInCard
          {t}
          minutes={checkIn.minutes}
          onsos={() => callForHelp(feed, 'general', deviceLocation.fix, t('checkInSosText'))}
        />
      {/key}
    {/if}
  {/if}
  <Navigation
    {t}
    {locale}
    {map}
    objects={slices.objects}
    positions={slices.positions}
    tasks={slices.tasks}
    teams={slices.teams}
    trails={slices.trails}
    self={group?.self ?? null}
    onfinishtask={async (task: TaskEvent) => {
      if (group === null) return;
      await saveTask(group.feed, t, task.task, { ...fieldsOf(task), status: 'done' });
    }}
  />
  {#if group?.practice}
    {#key group.feed}
      <Practice
        {t}
        {locale}
        feed={group.feed}
        self={group.self}
        role={group.role}
        situation={group.practice}
        here={deviceLocation.fix?.at ?? null}
        mapCentre={mapCentre(map)}
        {offline}
        onend={onendpractice}
      />
    {/key}
  {/if}
  <div class="aside" hidden={drawingOrMeasuring}>
    {#if group}
      <SharePrompt {t} sharing={group.sharing} />
    {/if}
    {#if weather}
      <WeatherCard {t} {locale} {weather} />
    {/if}
    {#if group}
      {#key group.feed}
        <OperationAreaOffer {t} {locale} groupState={group.feed.state} {offline} />
      {/key}
    {/if}
  </div>
  <Notices {t} />
</div>

<style>
  /* Clear of the map's controls on the right: one control wide, with MapLibre's 10 px margin; and
     of a notch on either side when the phone is held sideways. */
  .top {
    position: absolute;
    z-index: var(--layer-status);
    top: 0.75rem;
    right: calc(var(--control-size) + 1.25rem + env(safe-area-inset-right));
    left: max(0.75rem, env(safe-area-inset-left));
    display: grid;
    align-content: start;
    gap: 0.5rem;
    max-width: 30rem;
    max-height: calc(100% - 0.75rem - var(--dock-clearance));
    margin: 0 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: none;
  }

  /* Its cards take their places in the stack, as if the box were not there. */
  .aside {
    display: contents;
  }

  .aside[hidden] {
    display: none;
  }
</style>
