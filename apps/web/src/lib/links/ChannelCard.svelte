<!-- One way of reaching the group in the connections panel: its sign and name, a coloured dot with
     how it is doing (a grey ring when it is not in use), and what can be done with it. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { GlyphName } from '../ui/glyphs.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import { LEVEL_TONES, type Link } from './links.ts';

  interface Props {
    icon: GlyphName;
    name: string;
    /** How it is doing; `off` when it is simply not in use, as a radio not linked. */
    level: Link['level'] | 'off';
    status: string;
    children?: Snippet;
  }

  let { icon, name, level, status, children }: Props = $props();
</script>

<section class="channel {level}" aria-label={name}>
  <span class="sign"><Pictogram name={icon} size={28} /></span>
  <div class="body">
    <strong>{name}</strong>
    <span class="status"
      ><StatusDot tone={level === 'off' ? 'off' : LEVEL_TONES[level]} />{status}</span
    >
    {@render children?.()}
  </div>
</section>

<style>
  .channel {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.9rem;
    align-items: start;
    padding: 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  .channel.ok {
    border-color: var(--accent-line);
  }

  .sign {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    background: var(--bg);
    border-radius: var(--radius-card);
  }

  .ok .sign {
    color: var(--on-accent);
    background: var(--signal);
  }

  .body {
    display: grid;
    gap: 0.35rem;
  }

  strong {
    font-size: var(--text-title);
  }

  .status {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    font-size: var(--text-secondary);
  }
</style>
