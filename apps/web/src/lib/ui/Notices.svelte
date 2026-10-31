<!-- The app's notices (notices.svelte.ts), as cards in the stack at the top of the map. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import { notices } from './notices.svelte.ts';

  let { t }: { t: Translate } = $props();
</script>

{#each notices.list as notice (notice.id)}
  <div class="map-card notice" role="status">
    <span>{notice.text}</span>
    {#if notice.action}
      {@const { run, label } = notice.action}
      <!-- Done, a passing notice has said what it had to. -->
      <button
        class="primary"
        onclick={() => {
          run();
          if (!notice.stays) notices.withdraw(notice.id);
        }}>{label}</button
      >
    {/if}
    {#if notice.stays}
      <button
        class="icon"
        aria-label={t('close')}
        onclick={() => {
          notices.withdraw(notice.id);
        }}>✕</button
      >
    {/if}
  </div>
{/each}

<style>
  .notice {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .notice span {
    flex: 1;
  }
</style>
