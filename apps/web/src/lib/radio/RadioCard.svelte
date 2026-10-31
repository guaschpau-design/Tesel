<!-- The LoRa radio in the connections panel: whether one is paired and on the group, the button to
     pair or unpair it, and how much it is transmitting. -->
<script lang="ts">
  import { isWebBluetoothAvailable } from '@tesel/meshcore/link';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import ChannelCard from '../links/ChannelCard.svelte';
  import type { Link } from '../links/links.ts';
  import { radio, type RadioProblem } from './radio.svelte.ts';

  interface Props {
    t: Translate;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
  }

  let { t, groupName }: Props = $props();

  const supported = isWebBluetoothAvailable();

  const PROBLEMS: Readonly<Record<RadioProblem, MessageKey>> = {
    unsupported: 'radioUnsupported',
    'no-free-channel': 'radioNoFreeChannel',
    'no-answer': 'radioNoAnswer',
    failed: 'radioFailed',
  };

  /** How the radio is doing: paired and on the group's channel, waiting for a group, or not yet. */
  const card = $derived.by((): { level: Link['level'] | 'off'; status: string } => {
    const name = radio.name ?? t('radioUnnamed');
    if (!supported) return { level: 'off', status: t('radioUnsupported') };
    if (radio.state === 'disconnected') return { level: 'off', status: t('radioOff') };
    if (radio.state === 'ready' && !groupName) {
      return { level: 'connecting', status: t('radioWaiting', { name }) };
    }
    if (radio.state === 'ready' && radio.linked) {
      return { level: 'ok', status: t('radioLinked', { name }) };
    }
    return { level: 'connecting', status: t('linkConnecting') };
  });
</script>

<ChannelCard icon="mast" name={t('mediumLora')} level={card.level} status={card.status}>
  {#if supported && radio.state === 'ready'}
    <span class="hint">
      {t('radioDetails', { percent: Math.round(radio.airtimeUsed * 100) })}
      {#if radio.lastSnr !== null}· {t('radioSignal', { snr: radio.lastSnr })}{/if}
    </span>
  {/if}
  {#if radio.problem}<p class="warning">{t(PROBLEMS[radio.problem])}</p>{/if}
  {#if supported && radio.state === 'disconnected'}
    <div class="row">
      <button class="primary" onclick={() => radio.connect()}>{t('radioConnect')}</button>
    </div>
  {:else if supported && radio.state === 'ready'}
    <div class="row">
      <button onclick={() => radio.disconnect()}>{t('radioDisconnect')}</button>
    </div>
  {/if}
</ChannelCard>

<style>
  p {
    margin: 0;
  }
</style>
