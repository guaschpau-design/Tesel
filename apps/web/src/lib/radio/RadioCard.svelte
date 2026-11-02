<!-- The LoRa radio in the connections panel: whether one is paired and on the group, and of which
     kind, the button to pair or unpair it, and how much it is transmitting. -->
<script lang="ts">
  import { isWebBluetoothAvailable, type RadioFamily } from '@tesel/radio';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import ChannelCard from '../links/ChannelCard.svelte';
  import type { Link } from '../links/links.ts';
  import Explained from '../ui/Explained.svelte';
  import { problemMessage } from './radio-problem.ts';
  import { radio } from './radio.svelte.ts';

  interface Props {
    t: Translate;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
  }

  let { t, groupName }: Props = $props();

  const supported = isWebBluetoothAvailable();

  const FAMILIES: Readonly<Record<RadioFamily, MessageKey>> = {
    meshcore: 'radioMeshcore',
    meshtastic: 'radioMeshtastic',
  };

  /** How the radio is doing: paired and on the group's channel, waiting for a group, or not yet. */
  const card = $derived.by((): { level: Link['level'] | 'off'; status: string } => {
    const name = radio.name ?? t('radioUnnamed');
    const kind = radio.family === null ? '' : t(FAMILIES[radio.family]);
    if (!supported) return { level: 'off', status: t('radioUnsupported') };
    if (radio.state === 'disconnected') return { level: 'off', status: t('radioOff') };
    if (radio.state === 'ready' && !groupName) {
      return { level: 'connecting', status: t('radioWaiting', { name, kind }) };
    }
    if (radio.state === 'ready' && radio.linked) {
      return { level: 'ok', status: t('radioLinked', { name, kind }) };
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
  {#if radio.problem}
    <p class="warning">{t(problemMessage(radio.problem, radio.family))}</p>
  {/if}
  {#if radio.problem === 'not-paired'}
    <!-- The one case the user must act on outside Tesel: pairing in the system's settings. -->
    <ol class="steps">
      <li>{t('radioPairStep1')}</li>
      <li>{t('radioPairStep2')}</li>
      <li>{t('radioPairStep3')}</li>
    </ol>
  {/if}
  {#if supported && radio.state === 'disconnected'}
    <Explained label={t('aboutRadioConnect')} text={t('radioConnectHint')}>
      <button class="primary" onclick={() => radio.connect()}>{t('radioConnect')}</button>
    </Explained>
  {:else if supported}
    <!-- Also while it reconnects: a radio whose battery died can be let go and another paired. -->
    <div class="row">
      <button onclick={() => radio.disconnect()}>{t('radioDisconnect')}</button>
    </div>
  {/if}
</ChannelCard>

<style>
  p {
    margin: 0;
  }

  .steps {
    margin: 0;
    padding-left: 1.3rem;
  }
</style>
