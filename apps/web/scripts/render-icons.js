// Renders the app icons from brand/mark.svg with the Chromium that Playwright provides:
//
//   pnpm --filter @tesel/web icons
//
// Writes apps/web/public/icons: the PWA icons (any and maskable), the Apple touch icon and the
// favicons. Then stamps the favicon's version in the pages that link the icons (lib/ui/icon-links.ts),
// so browsers fetch the new ones. The mark sits on the ink of the app's top bar; maskable icons keep it inside the
// safe zone (80 % of the width) that launchers may crop to a circle.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { iconVersion, PAGES_WITH_ICONS, stampIconLinks } from '../src/lib/ui/icon-links.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

const { ink: INK } = JSON.parse(readFileSync(join(root, 'brand', 'colors.json'), 'utf8'));
const mark = readFileSync(join(root, 'brand', 'mark.svg'), 'utf8');
const out = join(here, '..', 'public', 'icons');

/** An icon page: the mark at `scale` of the square, on ink, with rounded corners when asked. */
function page(size, scale, radius) {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);
  return `<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;background:${INK};border-radius:${radius}px;overflow:hidden">
      <div style="width:${inner}px;height:${inner}px;margin:${pad}px">${mark.replace('<svg ', '<svg style="display:block;width:100%;height:100%" ')}</div>
    </div></body>`;
}

// The mark fills its own box corner to corner (a square on its point), so these scales are its
// share of the icon; the maskable one keeps its corners inside the safe circle (scale <= 0.8).
const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.72, radius: 0 },
  { file: 'icon-512.png', size: 512, scale: 0.72, radius: 0 },
  { file: 'maskable-512.png', size: 512, scale: 0.6, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.72, radius: 0 },
  { file: 'favicon-64.png', size: 64, scale: 0.84, radius: 12 },
];

await (async () => {
  const browser = await chromium.launch();
  for (const icon of icons) {
    const tab = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await tab.setContent(page(icon.size, icon.scale, icon.radius));
    const png = await tab.screenshot({ omitBackground: true });
    writeFileSync(join(out, icon.file), png);
    await tab.close();
  }
  await browser.close();
  // The SVG favicon: the mark on a rounded ink square, crisp at any size. The mark keeps its own
  // box (viewBox) inside, pale as the file has it.
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${INK}"/>${mark.trim().replace('<svg ', '<svg x="8" y="8" width="84" height="84" ')}</svg>`;
  writeFileSync(join(out, 'favicon.svg'), favicon);
  const version = iconVersion(favicon);
  for (const page of PAGES_WITH_ICONS) {
    const path = join(root, page);
    writeFileSync(path, stampIconLinks(readFileSync(path, 'utf8'), version));
  }
  console.warn(`${icons.length} icons and favicon.svg written to ${out}, version ${version}`);
})();
