<!-- What can be done with the thing a panel shows, as a row of equal tiles, a pictogram over a
     verb. Up to three fit a phone's width and all show; with more, the first two show and the rest
     wait in a "⋯" menu at the end of the row (ADR-0065). So list them most used first. An action
     marked folded, as deleting, always waits in the menu. -->
<script lang="ts">
  import type { Action } from './action.ts';
  import Menu from './Menu.svelte';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    actions: readonly Action[];
    /** The name of the "⋯" button and its menu. */
    moreLabel: string;
  }

  let { actions, moreLabel }: Props = $props();

  /** As many as fit a phone's width; past it, one place goes to the menu's button. */
  const FIT = 3;
  const main = $derived(actions.filter((action) => action.folded !== true));
  const shown = $derived(
    main.length <= FIT && main.length === actions.length ? main : main.slice(0, FIT - 1),
  );
  const folded = $derived(actions.filter((action) => !shown.includes(action)));
</script>

<div class="actions">
  {#each shown as action (action.label)}
    <button class="tile" onclick={action.run}>
      <Pictogram name={action.icon} size={22} />
      {action.label}
    </button>
  {/each}
  {#if folded.length > 0}
    <Menu label={moreLabel} place="end">
      {#snippet trigger(expanded: boolean, toggle: () => void)}
        <button
          class="tile"
          aria-haspopup="menu"
          aria-expanded={expanded}
          aria-label={moreLabel}
          title={moreLabel}
          onclick={toggle}
        >
          <Pictogram name="more" size={22} />
        </button>
      {/snippet}
      {#snippet items(close: () => void)}
        {#each folded as action (action.label)}
          <button
            role="menuitem"
            onclick={() => {
              close();
              action.run();
            }}
          >
            <Pictogram name={action.icon} size={20} />
            {action.label}
          </button>
        {/each}
      {/snippet}
    </Menu>
  {/if}
</div>

<style>
  /* Equal columns, however long each verb: a long one wraps under its pictogram. */
  .actions {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 0.5rem;
  }

  .tile {
    display: grid;
    flex: 1;
    gap: 0.2rem;
    place-items: center;
    padding: 0.5rem 0.25rem;
    font-size: var(--text-secondary);
    font-weight: 600;
  }
</style>
