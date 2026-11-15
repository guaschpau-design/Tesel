<!-- Typing a point as it was dictated, on a tool's card on the map, in place of a tap (drawing,
     picking a task's place): coordinates in any format the app writes, or, with the network, an
     address of Spain, which CartoCiudad finds (ADR-0139) and the user picks among what it found.
     The field is cleared for the next point once one is taken. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import { onDestroy } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { looksLikeAddress, searchAddresses, type FoundAddress } from './address-search.ts';
  import { parseCoordinate } from './coordinates.ts';

  interface Props {
    t: Translate;
    /** What the button does with the point: add it, or use it. */
    action: string;
    onpoint: (at: LatLon) => void;
  }

  let { t, action, onpoint }: Props = $props();

  let typed = $state('');
  /** What went wrong with what was typed, if anything. */
  let problem: 'unreadable' | 'not-found' | 'offline' | null = $state(null);
  let searching = $state(false);
  /** The addresses found, to pick one; null until an address is searched. */
  let found: readonly FoundAddress[] | null = $state(null);
  let search: AbortController | null = null;

  onDestroy(() => search?.abort());

  function take(at: LatLon): void {
    typed = '';
    found = null;
    onpoint(at);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    found = null;
    const at = parseCoordinate(typed);
    if (at !== null) {
      problem = null;
      take(at);
      return;
    }
    if (!looksLikeAddress(typed)) {
      problem = 'unreadable';
      return;
    }
    search?.abort();
    const asking = new AbortController();
    search = asking;
    searching = true;
    problem = null;
    try {
      const addresses = await searchAddresses(typed, asking.signal);
      if (asking.signal.aborted) return;
      found = addresses;
      if (addresses.length === 0) problem = 'not-found';
    } catch {
      if (!asking.signal.aborted) problem = 'offline';
    } finally {
      if (search === asking) searching = false;
    }
  }

  const PROBLEMS = {
    unreadable: 'coordinateUnreadable',
    'not-found': 'addressNotFound',
    offline: 'addressOffline',
  } as const;
</script>

<form class="entry" onsubmit={(event) => void submit(event)}>
  <input
    bind:value={typed}
    oninput={() => {
      problem = null;
      found = null;
    }}
    aria-label={t('coordinatesOrAddress')}
    placeholder={t('coordinatesOrAddressExample')}
    autocomplete="off"
    spellcheck="false"
  />
  <button type="submit" disabled={typed.trim() === '' || searching}>{action}</button>
</form>
{#if searching}
  <p class="hint" role="status">{t('addressSearching')}</p>
{:else if problem}
  <p class="warning" role="status">{t(PROBLEMS[problem])}</p>
{/if}
{#if found && found.length > 0}
  <ul class="found" aria-label={t('addressesFound')}>
    {#each found as address (address.name)}
      <li>
        <button
          onclick={() => {
            take(address.at);
          }}>{address.name}</button
        >
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* The field takes the width there is, and no more, its button beside it. */
  .entry {
    display: flex;
    gap: 0.35rem;
    min-width: 0;
  }

  .entry input {
    flex: 1 1 0;
    width: 0;
    min-width: 0;
  }

  .found {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .found button {
    width: 100%;
    text-align: left;
  }
</style>
