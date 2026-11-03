<!-- In the top bar: how this device reaches its group now, a coloured dot, a sign for each medium
     (WiFi, mobile data, LoRa) and the state in a word. Screen readers also hear the media by name.
     Opens the connections panel. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import {
    channelName,
    LEVEL_TONES,
    linkWord,
    networkSign,
    type Link,
    type Network,
  } from './links.ts';

  interface Props {
    t: Translate;
    link: Link;
    network: Network;
    /** How the network channel is doing, shown on hover. */
    detail: string;
    expanded: boolean;
    onclick: () => void;
  }

  let { t, link, network, detail, expanded, onclick }: Props = $props();

  /** The media in use, each with its sign; none while connecting or cut off. */
  const signs = $derived(link.level === 'ok' ? link.channels : []);
  const word = $derived(t(linkWord(link)));
  const media = $derived(signs.map((channel) => t(channelName(channel, network))).join(' · '));
</script>

<button
  class="link"
  {onclick}
  aria-expanded={expanded}
  aria-label="{t('connections')}: {word}{media ? ` (${media})` : ''}"
  title={detail}
>
  <StatusDot tone={LEVEL_TONES[link.level]} />
  {#each signs as channel (channel)}
    <Pictogram name={channel === 'radio' ? 'mesh' : networkSign(channel, network)} size={18} />
  {/each}
  <span>{word}</span>
</button>

<style>
  .link {
    /* The dark bar needs the bright lime for "good". */
    --status-good: var(--signal);

    display: inline-flex;
    flex-shrink: 0;
    gap: 0.45rem;
    align-items: center;
    margin-left: auto;
    padding: 0.3rem 0.65rem;
    font-size: var(--text-secondary);
    font-weight: 600;
    color: inherit;
    white-space: nowrap;
  }
</style>
