import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { topoNames } from './topo.ts';

function label(id: string): LayerSpecification {
  return { id, type: 'symbol', source: 'protomaps', layout: { 'text-size': 12 } };
}

describe("the topographic map's names", () => {
  it('leaves out the house numbers and keeps the small streets to close up', () => {
    const names = topoNames([label('address_label'), label('roads_labels_minor'), label('water')]);
    expect(names.map((layer) => layer.id)).toEqual(['roads_labels_minor', 'water']);
    const [streets] = names;
    expect(streets?.minzoom).toBe(16);
    expect(streets?.type === 'symbol' && streets.layout?.['text-size']).toBe(10);
  });
});
