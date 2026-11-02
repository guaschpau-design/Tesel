<!-- Warns on entering a danger area of the group, from this device's own position: a card on top
     of the map, a vibration, and an announcement for screen readers. Closing it lasts until the device leaves the area; entering again
     warns again. While the group has a danger area the GPS stays on for this, on the device only:
     nothing is shared that the user has not chosen to share. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import type { Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import { callAttention } from '../power/attention.ts';
  import { announcer } from '../ui/announcer.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { dangerZones, zonesAt } from './danger-zones.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
  }

  let { t, groupState }: Props = $props();

  const zones = $derived(dangerZones(groupState));
  const watching = $derived(zones.length > 0);

  $effect(() => {
    if (watching) return deviceLocation.use();
  });
  const inside = $derived(deviceLocation.fix ? zonesAt(zones, deviceLocation.fix.at) : []);
  /** Areas closed on this device while still inside them. */
  const dismissed = new SvelteSet<string>();
  const warned = $derived(inside.filter((zone) => !dismissed.has(zone.key)));

  // An area left is forgotten, so entering it again warns again; one entered vibrates.
  let known = new Set<string>();
  $effect(() => {
    const now = new Set(inside.map((zone) => zone.key));
    // Read without tracking: deleting from the set it reads would run this effect again.
    for (const key of untrack(() => [...dismissed])) if (!now.has(key)) dismissed.delete(key);
    const entered = inside.filter((zone) => !known.has(zone.key));
    if (entered.length > 0) {
      // Safari has no vibration API.
      if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);
      callAttention();
      const names = entered.map((zone) => zone.label || t('styleDanger')).join(' · ');
      announcer.say(`${t('dangerZoneEntered')}: ${names}`);
    }
    known = now;
  });
</script>

{#if warned.length > 0}
  <MapCard label={t('dangerZoneEntered')} edge="var(--danger)">
    <strong class="title">{t('dangerZoneEntered')}</strong>
    <p>{warned.map((zone) => zone.label || t('styleDanger')).join(' · ')}</p>
    <div class="row">
      <button
        onclick={() => {
          for (const zone of warned) dismissed.add(zone.key);
        }}>{t('understood')}</button
      >
    </div>
  </MapCard>
{/if}

<style>
  .title {
    color: var(--danger);
  }
</style>
