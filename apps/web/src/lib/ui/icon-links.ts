// Browsers keep favicons apart from their ordinary cache and do not fetch one again while its
// address stays the same, whatever the server says. So the pages link the icons with a version in
// the address, taken from the current favicon: it changes whenever the mark does. The icon
// generator (scripts/render-icons.js) stamps it, and a test checks every page carries it.

/** Pages that link the icons, from the repository root: the app's and the site's. */
export const PAGES_WITH_ICONS = [
  'apps/web/index.html',
  'apps/site/index.html',
  'apps/site/en/index.html',
  'apps/site/guia/index.html',
  'apps/site/en/guide/index.html',
] as const;

const ICON_LINK =
  /(href="[^"]*icons\/(?:favicon\.svg|favicon-64\.png|apple-touch-icon\.png))(?:\?v=[0-9a-f]+)?"/g;

/** A short fingerprint of the favicon's text (FNV-1a): not security, just change detection. */
export function iconVersion(favicon: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < favicon.length; index++) {
    hash ^= favicon.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The page with every icon link pointing at `version`. */
export function stampIconLinks(html: string, version: string): string {
  return html.replace(ICON_LINK, `$1?v=${version}"`);
}

/** The icon links of a page, as written. */
export function iconLinks(html: string): string[] {
  return [
    ...html.matchAll(
      /href="([^"]*icons\/(?:favicon\.svg|favicon-64\.png|apple-touch-icon\.png)[^"]*)"/g,
    ),
  ].map((match) => match[1] ?? '');
}
