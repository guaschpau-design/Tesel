// A phone held sideways (ADR-0130): the dock is a rail at the left with the SOS button at its foot,
// the map's controls a column at the right, and a panel a sheet between them: nothing covers
// anything else, on a low screen as on a taller one.

import type { Locator, Page } from '@playwright/test';

import { createGroup, device, expect, test } from './helpers.ts';

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(part: Locator): Promise<Box> {
  const box = await part.boundingBox();
  if (box === null) throw new Error('not on screen');
  return box;
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The parts that must never be covered, by their names. */
function parts(page: Page): Record<string, Locator> {
  return {
    dock: page.getByRole('navigation', { name: 'Acciones principales' }),
    sos: page.getByRole('button', { name: 'SOS', exact: true }),
    controls: page.locator('.maplibregl-ctrl-group'),
    scale: page.locator('.maplibregl-ctrl-scale'),
  };
}

for (const [width, height] of [
  [750, 300],
  [844, 390],
] as const) {
  test(`held sideways at ${String(width)}×${String(height)}, nothing covers anything`, async ({
    browser,
  }) => {
    const page = await device(browser, 'Ana', '/', { viewport: { width, height } });
    await createGroup(page, 'Rescate');
    await page.getByRole('button', { name: 'Cerrar' }).click();

    const boxes = Object.entries(parts(page));
    for (const [, part] of boxes) await expect(part).toBeVisible();
    const placed = await Promise.all(
      boxes.map(async ([name, part]) => [name, await boxOf(part)] as const),
    );
    for (const [i, [name, box]] of placed.entries()) {
      // Everything within the screen.
      expect(box.y + box.height, name).toBeLessThanOrEqual(height);
      for (const [other, otherBox] of placed.slice(i + 1)) {
        expect(overlap(box, otherBox), `${name} and ${other}`).toBe(false);
      }
    }

    // A panel opens beside the dock and the controls, over the map and its scale, and the map
    // shows at its left.
    await page.getByRole('button', { name: /^Tareas/ }).click();
    const panel = await boxOf(page.getByRole('region', { name: 'Tareas' }));
    for (const [name, box] of placed) {
      if (name !== 'scale') expect(overlap(panel, box), `panel and ${name}`).toBe(false);
    }
    expect(panel.width).toBeLessThan(width / 2 + 100);
  });
}
