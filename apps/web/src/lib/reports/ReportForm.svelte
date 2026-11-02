<!-- A situation report, in the order emergency services ask for it: what happens, then, folded,
     casualties by triage category, the dangers, the way in and the help needed, and a note. Only
     what happens is needed; it goes from where this device is. -->
<script lang="ts">
  import {
    REPORT_NOTE_MAX_BYTES,
    utf8ByteLength,
    type Casualties,
    type Hazard,
    type IncidentType,
    type LatLon,
    type Resource,
    type SceneAccess,
  } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import { formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { ReportFields } from '../sync/event-fields.ts';
  import Fold from '../ui/Fold.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { ACCESS, HAZARDS, INCIDENTS, labelOf, RESOURCES, TRIAGE } from './report-catalog.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** Sends the report; rejects if it could not be. */
    onsend: (report: ReportFields) => Promise<void>;
    oncancel: () => void;
  }

  let { t, locale, onsend, oncancel }: Props = $props();

  let incident: IncidentType | null = $state(null);
  let casualties: Casualties = $state({ red: null, yellow: null, green: null, black: null });
  let hazards: Hazard[] = $state([]);
  let access: SceneAccess = $state('unknown');
  let resources: Resource[] = $state([]);
  let note = $state('');
  const submission = new Submission();

  const here: LatLon | null = $derived(deviceLocation.fix?.at ?? null);
  const tooLong = $derived(utf8ByteLength(note.trim()) > REPORT_NOTE_MAX_BYTES);
  /** At most what the protocol counts: 254 (§3.16). */
  const MAX_COUNT = 254;

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  /** One more or one less; one less than none goes back to not known. */
  function count(key: keyof Casualties, step: number): void {
    const current = casualties[key];
    const next =
      step < 0 && (current ?? 0) === 0 ? null : Math.min(MAX_COUNT, (current ?? 0) + step);
    casualties = { ...casualties, [key]: next };
  }

  /** The casualties counted, by category: "Red 1 · Green 2". */
  const counted = $derived(
    TRIAGE.flatMap((category) => {
      const value = casualties[category.value];
      return value === null ? [] : [`${t(category.label)} ${String(value)}`];
    }).join(' · '),
  );

  function send(chosen: IncidentType): void {
    void submission.run(async () => {
      await onsend({
        place: here && { kind: 'point', at: here },
        incident: chosen,
        hazards,
        access,
        casualties,
        resources,
        note: note.trim(),
      });
    });
  }

  onMount(() => deviceLocation.use());
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    if (incident) send(incident);
  }}
>
  <fieldset>
    <legend>{t('reportIncident')}</legend>
    <div class="chips" role="radiogroup" aria-label={t('reportIncident')}>
      {#each INCIDENTS as choice (choice.value)}
        <button
          type="button"
          class="chip"
          role="radio"
          aria-checked={incident === choice.value}
          onclick={() => (incident = choice.value)}>{t(choice.label)}</button
        >
      {/each}
    </div>
  </fieldset>
  <div>
    <Fold title={t('reportCasualtiesTitle')} summary={counted || t('reportNoneMarked')}>
      {#each TRIAGE as category (category.value)}
        {@const value = casualties[category.value]}
        <div class="count {category.value}" role="group" aria-label={t(category.label)}>
          <span class="name">{t(category.label)}</span>
          <button
            type="button"
            aria-label={t('countLess', { name: t(category.label) })}
            onclick={() => {
              count(category.value, -1);
            }}>−</button
          >
          <strong>{value ?? '–'}</strong>
          <button
            type="button"
            aria-label={t('countMore', { name: t(category.label) })}
            onclick={() => {
              count(category.value, 1);
            }}>+</button
          >
        </div>
      {/each}
    </Fold>
    <Fold
      title={t('reportHazardsTitle')}
      summary={hazards.length === 0
        ? t('reportNoneMarked')
        : hazards.map((value) => t(labelOf(HAZARDS, value) ?? 'incidentOther')).join(', ')}
    >
      <div class="chips">
        {#each HAZARDS as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={hazards.includes(choice.value)}
            onclick={() => (hazards = toggle(hazards, choice.value))}>{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
    <Fold
      title={t('reportAccessTitle')}
      summary={access === 'unknown'
        ? t('reportNoneMarked')
        : t(labelOf(ACCESS, access) ?? 'accessClear')}
    >
      <div class="chips">
        {#each ACCESS as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={access === choice.value}
            onclick={() => (access = access === choice.value ? 'unknown' : choice.value)}
            >{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
    <Fold
      title={t('reportResourcesTitle')}
      summary={resources.length === 0
        ? t('reportNoneMarked')
        : resources.map((value) => t(labelOf(RESOURCES, value) ?? 'incidentOther')).join(', ')}
    >
      <div class="chips">
        {#each RESOURCES as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={resources.includes(choice.value)}
            onclick={() => (resources = toggle(resources, choice.value))}>{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
  </div>
  <label>
    {t('reportNote')}
    <input bind:value={note} autocomplete="off" />
  </label>
  {#if tooLong}<p class="warning">{t('reportNoteTooLong')}</p>{/if}
  <p class="hint">
    {#if deviceLocation.fix}
      {t('reportFromHere', {
        accuracy: formatDistance(deviceLocation.fix.accuracy ?? 0, locale),
      })}
    {:else}
      {t('reportNoPlace')}
    {/if}
  </p>
  {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={incident === null || tooLong || submission.busy}
      >{t('reportSend')}</button
    >
    <button type="button" onclick={oncancel}>{t('cancel')}</button>
  </div>
</form>

<style>
  /* One category to a row: its colour and name, then the count between "less" and "more". */
  .count {
    display: grid;
    grid-template-columns: 1fr auto 2.5rem auto;
    gap: 0.35rem;
    align-items: center;
    padding-left: 0.6rem;
    border-left: 4px solid var(--triage);
  }

  .count strong {
    text-align: center;
  }

  .count button {
    min-width: var(--control-size);
    padding: 0;
  }

  .red {
    --triage: var(--tone-red);
  }

  .yellow {
    --triage: var(--tone-amber);
  }

  .green {
    --triage: var(--tone-green);
  }

  .black {
    --triage: var(--tone-ink);
  }

  /* Ink would vanish on a dark surface: grey still reads as the darkest of the four. */
  @media (prefers-color-scheme: dark) {
    .black {
      --triage: var(--muted);
    }
  }
</style>
