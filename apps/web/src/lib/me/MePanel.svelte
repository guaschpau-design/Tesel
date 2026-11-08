<!-- "Me": the name this person goes by, which the pencil beside it changes; what they tell the
     team (profile, status, equipment), their battery, radio and tasks, and their position: one
     switch to share it, where they are, and a way to tell it to someone without Tesel. The GPS
     runs while the panel is open. -->
<script lang="ts">
  import { teamOf, type GroupState } from '@tesel/core';
  import type { DutyStatus, Equipment, NodeId, Profile } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import CoordinateLine from '../coordinates/CoordinateLine.svelte';
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import AliasField from '../identity/AliasField.svelte';
  import { normalizeAlias } from '../identity/identity.ts';
  import { ownEquipment } from '../members/member-catalog.ts';
  import MemberSheet from '../members/MemberSheet.svelte';
  import { accuracyQuality } from '../position/accuracy.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import { radio } from '../radio/radio.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import { pendingFor } from '../tasks/tasks.ts';
  import Panel from '../ui/Panel.svelte';
  import { openPanel } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import type { StatusTone } from '../ui/status-tone.ts';
  import { attempt, Submission } from '../ui/submission.svelte.ts';
  import type { SelfName } from '../workspace/workspace.ts';
  import { outsideText } from '../incidents/tell-outside.ts';
  import TellOutside from '../incidents/TellOutside.svelte';
  import { deviceBattery } from './battery.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** The name this device goes by, once it has one. */
    name: SelfName | null;
    preferences: Preferences;
    /** The active group and this device in it; null without one. */
    group: {
      readonly state: GroupState;
      readonly self: NodeId;
      readonly sharing: PositionSharing;
    } | null;
    onclose: () => void;
  }

  let { t, locale, name, preferences, group, onclose }: Props = $props();

  const QUALITY: Readonly<Record<StatusTone, MessageKey>> = {
    good: 'accuracyGood',
    fair: 'accuracyFair',
    poor: 'accuracyPoor',
  };

  const sharing = $derived(group?.sharing ?? null);

  /** Whether the name is being changed, and the new one as typed. */
  let editing = $state(false);
  let typed = $state('');
  const renaming = new Submission();

  function rename(event: SubmitEvent, self: SelfName): void {
    event.preventDefault();
    const alias = normalizeAlias(typed);
    if (alias === null) return;
    void renaming.run(async () => {
      await self.rename(alias);
      editing = false;
    });
  }

  onMount(() => deviceLocation.use());
</script>

{#snippet who()}
  {#if name}
    {@const alias = name.alias}
    <div class="who">
      <h2>{alias}</h2>
      <button
        class="icon"
        aria-label={t('renameSelf')}
        aria-expanded={editing}
        onclick={() => {
          typed = alias;
          editing = !editing;
        }}
      >
        <Pictogram name="pencil" size={18} />
      </button>
    </div>
  {/if}
{/snippet}

<Panel title={t('me')} closeLabel={t('close')} {onclose} header={name ? who : undefined}>
  {#if name && editing}
    <form
      class="stack section"
      onsubmit={(event) => {
        rename(event, name);
      }}
    >
      <AliasField {t} text={typed} ontext={(text: string) => (typed = text)} />
      {#if renaming.failed}<p class="warning">{t('actionFailed')}</p>{/if}
      <div class="row">
        <button
          type="submit"
          class="primary"
          disabled={normalizeAlias(typed) === null || renaming.busy}>{t('save')}</button
        >
        <button type="button" onclick={() => (editing = false)}>{t('cancel')}</button>
      </div>
    </form>
  {/if}
  <div class="section">
    <MemberSheet
      {t}
      state={{
        profile: preferences.profile.value,
        status: preferences.dutyStatus.value,
        battery: deviceBattery.percent,
        equipment: ownEquipment(preferences.equipment.value, radio.linked),
      }}
      edits={{
        onprofile: (profile: Profile) => void preferences.profile.set(profile),
        onstatus: (status: DutyStatus) => void preferences.dutyStatus.set(status),
        onequipment: (equipment: readonly Equipment[]) =>
          void preferences.equipment.set(ownEquipment(equipment, false)),
        onconnectradio: () => {
          openPanel('connections');
        },
      }}
      team={group ? teamOf(group.state.teams, group.self) : null}
      batteryNote={deviceBattery.supported ? undefined : t('batteryUnsupported')}
      tasks={group ? pendingFor(group.state, group.self, group.self) : null}
    >
      {#snippet position()}
        {#if sharing}
          {@const current = sharing}
          <SwitchRow
            icon="locate"
            label={t('shareMyPosition')}
            on={current.mode === 'sharing'}
            onclick={() => {
              attempt(
                () => current.setMode(current.mode === 'sharing' ? 'paused' : 'sharing'),
                t('actionFailed'),
              );
            }}
          />
          {#if current.mode !== 'sharing'}
            <SwitchRow
              icon="hidden"
              label={t('hideLastPosition')}
              on={current.mode === 'hidden'}
              onclick={() => {
                attempt(
                  () => current.setMode(current.mode === 'hidden' ? 'paused' : 'hidden'),
                  t('actionFailed'),
                );
              }}
            />
            <p class="hint">
              {current.mode === 'hidden' ? t('positionHiddenHint') : t('positionNotSharedHint')}
            </p>
          {/if}
        {/if}
        {#if deviceLocation.fix}
          {@const fix = deviceLocation.fix}
          <CoordinateLine {t} at={fix.at} format={preferences.coordinateFormat} />
          {#if deviceLocation.fix.accuracy !== null}
            {@const quality = accuracyQuality(deviceLocation.fix.accuracy)}
            <p class="accuracy">
              <StatusDot tone={quality} />
              {t('gpsQuality', {
                quality: t(QUALITY[quality]),
                distance: formatDistance(deviceLocation.fix.accuracy, locale),
              })}
            </p>
          {/if}
          <TellOutside
            {t}
            text={outsideText({ kind: 'position', name: name?.alias ?? t('me') }, fix, t, locale)}
          />
        {:else if deviceLocation.problem}
          <p class="warning">
            {deviceLocation.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}
          </p>
        {:else}
          <p class="hint">{t('navigationWaitingFix')}</p>
        {/if}
      {/snippet}
    </MemberSheet>
  </div>
</Panel>

<style>
  .who {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    min-width: 0;
  }

  .who h2 {
    margin: 0;
    overflow: hidden;
    font-size: var(--text-title);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .accuracy {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
  }
</style>
