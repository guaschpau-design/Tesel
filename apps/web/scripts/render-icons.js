// Renders the app icons from brand/mark.svg with the Chromium that Playwright provides:
//
//   pnpm --filter @tesel/web icons
//
// Writes apps/web/public/icons: the PWA icons (any and maskable), the Apple touch icon and the
// favicons; and the Android app's launcher icons (apps/mobile, ADR-0124): square and round, for
// Android before 8, and the mark alone that Android 8 and later lay on ink in their own shape. Then stamps the favicon's version in the pages that link the icons (lib/ui/icon-links.ts),
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
const androidRes = join(root, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res');

/**
 * An icon page: the mark at `scale` of the square, on ink with rounded corners when asked, or on
 * nothing at all (`ground` false).
 */
function page(size, scale, radius, ground = true) {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);
  return `<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;background:${ground ? INK : 'transparent'};border-radius:${radius}px;overflow:hidden">
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

// Android's launcher icons at each screen density, by its pixels per dp: 48 dp square and round
// ones, and the 108 dp foreground of the adaptive icon, whose mark keeps inside the 66 dp that every
// launcher's shape shows (scale 0.46).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const androidIcons = Object.entries(DENSITIES).flatMap(([density, ratio]) => {
  const folder = join(androidRes, `mipmap-${density}`);
  const legacy = 48 * ratio;
  return [
    { file: join(folder, 'ic_launcher.png'), size: legacy, scale: 0.72, radius: legacy * 0.18 },
    { file: join(folder, 'ic_launcher_round.png'), size: legacy, scale: 0.6, radius: legacy / 2 },
    {
      file: join(folder, 'ic_launcher_foreground.png'),
      size: 108 * ratio,
      scale: 0.46,
      radius: 0,
      ground: false,
    },
  ];
});

/**
 * The mark for Android's status bar, as a vector in one colour, as Android asks: the tiles turned
 * inside the pin as in the mark.
 */
function statusBarIcon() {
  const clip = /<clipPath[^>]*><path d="([^"]+)"/.exec(mark)?.[1] ?? '';
  const turn = /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(mark) ?? [];
  const size = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(mark) ?? [];
  const tiles = [...mark.matchAll(/<path d="([^"]+)" fill="[^"]+"/g)].map(
    ([, d]) => `\n        <path android:fillColor="#FFFFFFFF" android:pathData="${d}" />`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Tesel's mark for the status bar, in one colour as Android asks (apps/web/scripts/render-icons.js). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="${size[1]}"
    android:viewportHeight="${size[2]}">
    <group android:rotation="${turn[1]}" android:pivotX="${turn[2]}" android:pivotY="${turn[3]}">
        <clip-path android:pathData="${clip}" />${tiles.join('')}
    </group>
</vector>
`;
}

await (async () => {
  const browser = await chromium.launch();
  const render = async (icon, file) => {
    const tab = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await tab.setContent(page(icon.size, icon.scale, icon.radius, icon.ground));
    writeFileSync(file, await tab.screenshot({ omitBackground: true }));
    await tab.close();
  };
  for (const icon of icons) await render(icon, join(out, icon.file));
  for (const icon of androidIcons) await render(icon, icon.file);
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
  writeFileSync(join(androidRes, 'drawable', 'ic_stat_tesel.xml'), statusBarIcon());
  console.warn(
    `${androidIcons.length} launcher icons and the status bar icon written to ${androidRes}`,
  );
})();
