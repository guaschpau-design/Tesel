<!-- Active SOS calls, on top of the map until they are cancelled. Another member's call says how
     far it is and which way, and guides there in one tap; this device's own shows where it is. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { EventRef, LatLon, NodeId } from '@tesel/protocol';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import { shownText } from '../text.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { activeSos } from './incidents.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Whether this device may cancel other members' SOS calls (coordinators). */
    canCancelOthers: boolean;
    onacknowledge: (target: EventRef) => void;
    oncancel: (sos: EventRef) => void;
    /** Own events that have reached no one yet, by event reference key. */
    undelivered: ReadonlySet<string>;
    /** Shows where an SOS is on the map. */
    onshow: (at: LatLon) => void;
    /** Guides to where an SOS is, named after its caller. */
    onguide: (at: LatLon, name: string) => void;
  }

  let {
    t,
    locale,
    groupState,
    self,
    canCancelOthers,
    onacknowledge,
    oncancel,
    undelivered,
    onshow,
    onguide,
  }: Props = $props();

  const calls = $derived(activeSos(groupState, self));

  async function cancel(sos: EventRef): Promise<void> {
    const text = t('confirmCancelSos');
    if (await confirmations.ask({ text, confirm: t('cancelSos') })) oncancel(sos);
  }
</script>

<div class="banners">
  {#each calls as call (call.key)}
    {@const where = call.where}
    <MapCard label="SOS" edge="var(--danger)">
      <strong class="caller">SOS · {call.author} · {t(SOS_KINDS[call.event.kind].label)}</strong>
      <span class="when">{formatTime(call.event.time * 1000, locale)}</span>
      {#if call.event.text}<p>{shownText(call.event.text)}</p>{/if}
      {#if where.kind === 'shared'}
        <p class="where">{t('sosPlaceShared', { time: formatTime(where.time * 1000, locale) })}</p>
      {:else if where.kind === 'unknown'}
        <p class="where warning">{t('sosPlaceUnknown')}</p>
      {/if}
      {#if !call.mine && where.kind !== 'unknown'}
        <FromHere {t} {locale} at={where.at} />
      {/if}
      {#if call.mine && undelivered.has(call.ref)}
        <p class="warning">{t('sosNotSentYet')}</p>
      {/if}
      <p class="acks">
        {call.by.length > 0
          ? t('acknowledgedBy', { names: call.by.join(', ') })
          : t('notAcknowledged')}
      </p>
      <div class="row">
        {#if !call.mine && !call.bySelf}
          <button
            class="primary"
            onclick={() => {
              onacknowledge(call.event);
            }}>{t('acknowledge')}</button
          >
        {/if}
        {#if where.kind !== 'unknown'}
          {#if call.mine}
            <button
              onclick={() => {
                onshow(where.at);
              }}>{t('showOnMap')}</button
            >
          {:else}
            <button
              onclick={() => {
                onguide(where.at, call.author);
              }}>{t('guideMe')}</button
            >
          {/if}
        {/if}
        {#if call.mine || canCancelOthers}
          <button
            onclick={() => {
              void cancel(call.event);
            }}>{t('cancelSos')}</button
          >
        {/if}
      </div>
    </MapCard>
  {/each}
</div>

<style>
  .banners {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    pointer-events: none;
  }

  /* Tighter than other cards: several may stack. */
  .banners :global(.map-card) {
    gap: 0.3rem;
  }

  .caller {
    color: var(--danger);
  }

  .when,
  .acks {
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
