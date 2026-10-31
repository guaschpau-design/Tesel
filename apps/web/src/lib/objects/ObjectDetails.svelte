<!-- What a map object is, who last changed it, guidance there or along it, a task at it, changing
     its label and kind, and deleting it for the whole group. A search area tells how its sweep goes, and lets whoever
     coordinates plan one or remove it; a strip of a sweep, how far it is swept. -->
<script lang="ts">
  import { areaSquareMeters, lanesLength, pathMeters, type GroupState } from '@tesel/core';
  import { eventRefKey, ShapeStyleCode, type Place } from '@tesel/protocol';

  import CoordinateLine from '../coordinates/CoordinateLine.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatArea, formatDistance, formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import { objectDestination } from '../navigation/target.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { Action } from '../ui/action.ts';
  import Actions from '../ui/Actions.svelte';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { openPanel } from '../ui/panels.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';
  import { objectKind } from './catalog.ts';
  import { objectTitle } from './object-names.ts';
  import SweepProgress from './SweepProgress.svelte';
  import { stripOf, stripsOver } from './sweeps.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    objectKey: string;
    format: Preference<CoordinateFormat>;
    /** This device coordinates: it plans sweeps. */
    coordinator: boolean;
    /** Guide this device there, or along it; the name says where to. */
    onnavigate: (name: string) => void;
    /** Starts a task at the object. */
    ontask: (place: Place) => void;
    /** Changes its label and its symbol or style. */
    onedit: () => void;
    /** Starts planning a sweep of this area. */
    onplansweep: () => void;
    /** Removes the sweep of this area: its strips, by key, and what is left of their tasks. */
    onremovesweep: (strips: readonly string[]) => Promise<void>;
    ondelete: () => Promise<void>;
    onclose: () => void;
  }

  let {
    t,
    locale,
    groupState,
    objectKey,
    format,
    coordinator,
    onnavigate,
    ontask,
    onedit,
    onplansweep,
    onremovesweep,
    ondelete,
    onclose,
  }: Props = $props();

  const record = $derived(groupState.objects.get(objectKey));
  const object = $derived(record?.type === 'object-delete' ? undefined : record);
  const kindName = $derived(object ? t(objectKind(object)) : '');
  const title = $derived(object ? objectTitle(object, groupState.objects, t) : '');
  const destination = $derived(objectDestination(record, groupState.objects));
  const at = $derived(destination?.kind === 'point' ? destination.at : null);
  const strip = $derived(record?.type === 'sweep' ? stripOf(record, groupState.objects) : null);
  const isArea = $derived(record?.type === 'shape' && record.geometry.kind === 'polygon');
  /** The strips of this area's sweep, if it has one. */
  const strips = $derived(isArea ? stripsOver(groupState.objects, objectKey) : []);
  const canPlan = $derived(
    coordinator &&
      record?.type === 'shape' &&
      isArea &&
      record.style === ShapeStyleCode.SEARCH_ASSIGNED &&
      strips.length === 0,
  );
  const follow: MessageKey = $derived(
    record?.type === 'sweep'
      ? 'followStrip'
      : destination?.kind === 'route'
        ? 'followRoute'
        : 'guideMe',
  );
  const taskLabel: MessageKey = $derived(
    record?.type === 'sweep'
      ? 'taskOnStrip'
      : destination?.kind === 'route'
        ? 'taskOnRoute'
        : 'taskHere',
  );
  /** What can be measured of a line, an area, a circle or the lanes of a strip. */
  const measure = $derived.by(() => {
    if (strip) {
      return t('stripMeasure', {
        length: formatDistance(lanesLength(strip.lanes), locale),
        lanes: strip.lanes.lanes.length,
        spacing: strip.sweep.spacing,
      });
    }
    if (record?.type !== 'shape') return null;
    const { geometry } = record;
    switch (geometry.kind) {
      case 'polyline':
        return formatDistance(pathMeters(geometry.points), locale);
      case 'polygon':
        return formatArea(areaSquareMeters(geometry.points), locale);
      case 'circle':
        return t('measureRadius', { radius: formatDistance(geometry.radius, locale) });
    }
  });

  async function remove(): Promise<void> {
    const text = t('confirmDeleteObject', { name: title });
    if (!(await confirmations.ask({ text, confirm: t('delete') }))) return;
    attempt(async () => {
      await ondelete();
      onclose();
    }, t('actionFailed'));
  }

  async function removeSweep(): Promise<void> {
    const text = t('confirmRemoveSweep', { name: title });
    if (!(await confirmations.ask({ text, confirm: t('sweepRemove') }))) return;
    const keys = strips.map((item) => item.key);
    attempt(() => onremovesweep(keys), t('actionFailed'));
  }

  /** Most used first: deleting comes last. */
  const actions: Action[] = $derived.by(() => {
    if (!object) return [];
    const list: Action[] = [];
    if (canPlan) list.push({ icon: 'sweep', label: t('sweepPlan'), run: onplansweep });
    if (destination) {
      list.push({
        icon: destination.kind === 'route' ? 'route' : 'heading',
        label: t(follow),
        run: () => {
          onnavigate(title);
        },
      });
    }
    if (strip) {
      const area = strip.area;
      list.push({
        icon: 'area',
        label: t('stripShowArea'),
        run: () => {
          openPanel({ name: 'object', key: eventRefKey(area.object) });
        },
      });
    }
    const place: Place = { kind: 'object', object: object.object };
    list.push({
      icon: 'task',
      label: t(taskLabel),
      run: () => {
        ontask(place);
      },
    });
    // A strip is made by its sweep, not drawn: it is changed by planning the sweep again.
    if (object.type !== 'sweep') list.push({ icon: 'pencil', label: t('edit'), run: onedit });
    if (coordinator && strips.length > 0) {
      list.push({
        icon: 'sweep',
        label: t('sweepRemove'),
        run: () => void removeSweep(),
        folded: true,
      });
    }
    list.push({ icon: 'trash', label: t('delete'), run: () => void remove(), folded: true });
    return list;
  });
</script>

{#if object}
  <Panel {title} closeLabel={t('close')} {onclose}>
    <div class="stack section">
      <p>
        {kindName}{#if measure}&nbsp;· {measure}{/if}
      </p>
      {#if at}
        <CoordinateLine {t} {at} {format} />
        <FromHere {t} {locale} {at} />
      {/if}
      {#if object.type === 'sweep'}
        <SweepProgress {t} {groupState} strips={[{ key: objectKey, sweep: object }]} />
      {/if}
      {#if strips.length > 0}
        <h3>{t('sweepTitle')}</h3>
        <SweepProgress
          {t}
          {groupState}
          {strips}
          onselect={(key: string) => {
            openPanel({ name: 'object', key });
          }}
        />
      {/if}
      <p class="hint">
        {t('changedBy', {
          name: aliasOf(groupState, object.origin),
          time: formatTime(object.time * 1000, locale),
        })}
      </p>
      <Actions {actions} moreLabel={t('moreActions')} />
    </div>
  </Panel>
{/if}
