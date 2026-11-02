// The chat panel's tabs: the group's messages, its situation reports, and the texts of other
// apps the radio hears (MeshCore or Meshtastic chat). The chat panel carries which one it shows
// (ui/panels.svelte.ts).

export type ChatTab = 'group' | 'reports' | 'mesh';

/** The chat panel on the group's messages: what its button opens. */
export const CHAT = { name: 'chat', tab: 'group' } as const;

/** The chat panel on the reports: what a report tapped on the map opens. */
export const REPORTS = { name: 'chat', tab: 'reports' } as const;
