<!-- One line of a chat list, as a bubble: who wrote it or where it was heard, the text with its
     time at the end, and a word while it has reached no one yet. The user's own lines sit at the
     end of the row. It is the list item itself, so the list scrolls to it as to any item. -->
<script lang="ts">
  interface Props {
    text: string;
    /** When it was written or heard, as shown. */
    time: string;
    /** Above the text: who wrote it, or where it was heard. */
    meta?: string | undefined;
    own?: boolean;
    /** Follows a line of the same person's: shown close to it. */
    follows?: boolean;
    /** Under the text while the line has reached no one yet. */
    pending?: string | undefined;
  }

  let { text, time, meta, own = false, follows = false, pending }: Props = $props();
</script>

<li class:own class:follows>
  {#if meta !== undefined}<span class="meta">{meta}</span>{/if}
  <span class="line">
    <span class="text">{text}</span>
    <span class="time">{time}</span>
  </span>
  {#if pending !== undefined}<span class="pending">{pending}</span>{/if}
</li>

<style>
  li {
    display: grid;
    justify-self: start;
    max-width: 85%;
    padding: 0.35rem 0.6rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  /* A line under the one before it, from the same person: close to it, and without the name. */
  li.follows {
    margin-top: -0.2rem;
  }

  li.own {
    justify-self: end;
    border-color: var(--accent-line);
  }

  .meta {
    color: var(--muted);
    font-size: var(--text-small);
  }

  /* The text, and its time at the end of its last line. */
  .line {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
    align-items: baseline;
  }

  .text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .time {
    margin-left: auto;
    color: var(--muted);
    font-size: var(--text-small);
  }

  .pending {
    color: var(--muted);
    font-size: var(--text-small);
    font-style: italic;
  }
</style>
