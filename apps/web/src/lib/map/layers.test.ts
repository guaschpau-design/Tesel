import { describe, expect, it } from 'vitest';

import { LAYER_GROUPS, MAP_FLAGS, MAP_LAYERS, shownLayers } from './layers.ts';

describe('map layers', () => {
  it('has one switch for every layer and flag', () => {
    const listed = LAYER_GROUPS.flatMap((group) => group.switches.map((item) => item.name));
    expect(listed.sort()).toEqual([...MAP_LAYERS, ...MAP_FLAGS].sort());
  });

  it('shows the layers not hidden, and decluttered only the team and the markers', () => {
    const shown = (declutter: boolean) =>
      Object.entries(shownLayers(['objects'], declutter))
        .filter(([, on]) => on)
        .map(([layer]) => layer);
    expect(shown(false)).toEqual(['members', 'trails', 'tasks', 'reports', 'services', 'weather']);
    expect(shown(true)).toEqual(['members']);
  });
});
