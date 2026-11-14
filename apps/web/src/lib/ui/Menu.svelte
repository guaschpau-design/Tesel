<!-- A button that opens a short menu above it: the dock's menus, and the extra actions of a panel.
     The menu closes when an item that does something calls `close`, when the user taps elsewhere
     or presses Escape; a switch in it leaves it open, so its change is seen. From the keyboard,
     the first item takes the focus, the arrow keys move between items, and closing gives the focus
     back to the button. The menu follows its button in the page, as screen readers read it. -->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';

  interface Props {
    /** The menu's name, for screen readers. */
    label: string;
    /**
     * Where the menu opens, above its button: against the dock's right edge, so it stays on
     * screen, or from the button's start or end edge, inside a panel.
     */
    place: 'dock' | 'start' | 'end';
    /** The button, with whether the menu is open and what opens or closes it. */
    trigger: Snippet<[expanded: boolean, toggle: () => void]>;
    /** The items; those that do something call `close` once chosen. */
    items: Snippet<[close: () => void]>;
  }

  let { label, place, trigger, items }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement;
  let menu: HTMLDivElement | undefined = $state();

  function close(): void {
    if (menu?.contains(document.activeElement)) button()?.focus();
    open = false;
  }

  function button(): HTMLElement | null {
    return root.querySelector<HTMLElement>(':scope > button');
  }

  async function toggle(): Promise<void> {
    open = !open;
    if (!open) return;
    await tick();
    menuItems()[0]?.focus();
  }

  function menuItems(): HTMLElement[] {
    return menu ? [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')] : [];
  }

  /** Arrow keys go round the items; Home and End to the first and last. */
  function onMenuKey(event: KeyboardEvent): void {
    const all = menuItems();
    const at = all.findIndex((item) => item === document.activeElement);
    const to: Record<string, number> = {
      ArrowDown: (at + 1) % all.length,
      ArrowUp: (at - 1 + all.length) % all.length,
      Home: 0,
      End: all.length - 1,
    };
    const next = to[event.key];
    if (next === undefined || all.length === 0) return;
    event.preventDefault();
    all[next]?.focus();
  }

  /** Escape closes the menu only, not the panel it may be in. */
  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    close();
  }

  function onPointerDown(event: PointerEvent): void {
    if (open && event.target instanceof Node && !root.contains(event.target)) close();
  }
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKey} />

<!-- It only hears Escape from its button and items. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-root {place}" bind:this={root} onkeydown={onKey}>
  {@render trigger(open, () => void toggle())}
  {#if open}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label={label}
      bind:this={menu}
      onkeydown={onMenuKey}
    >
      {@render items(close)}
    </div>
  {/if}
</div>

<style>
  .menu-root {
    position: relative;
    display: flex;
  }

  /* Not positioned: the menu places itself against the dock. */
  .menu-root.dock {
    position: static;
    flex: 1;
  }

  .menu {
    position: absolute;
    z-index: var(--layer-popup);
    bottom: calc(100% + 0.4rem);
    display: grid;
    gap: 0.25rem;
    width: max-content;
    max-width: min(18rem, calc(100vw - 2rem));
    padding: 0.4rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-float);
  }

  .start .menu {
    left: 0;
  }

  .end .menu {
    right: 0;
  }

  .dock .menu {
    right: 0;
    bottom: calc(100% + 0.75rem);
    width: min(18rem, calc(100vw - 2rem));
    /* A phone held sideways has little height: the menu scrolls rather than leave the map. */
    max-height: calc(100cqh - var(--dock-clearance) - 1.5rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* On the rail of a phone held sideways (ADR-0130), the dock's menus open to its right. */
  @media (orientation: landscape) and (max-height: 32rem) {
    .dock .menu {
      top: 0;
      right: auto;
      bottom: auto;
      left: calc(100% + 0.5rem);
      max-height: calc(100cqh - 1rem);
    }
  }

  /* Items are buttons with a pictogram, a name and, for a choice, its switch. */
  .menu :global(button) {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-auto-flow: column;
    gap: 0.15rem 0.7rem;
    align-items: center;
    text-align: left;
    border-color: transparent;
  }
</style>
