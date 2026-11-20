// New versions of the app: asking for them while the app stays open, and keeping a window that
// waits for one working on the version it runs (ADR-0110).

/** How often an app left open asks the server whether there is a new version. */
export const CHECK_EVERY_MS = 60 * 60 * 1000;

/** What checking needs of the page: whether it is shown, and being told when that changes. */
type Page = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;

/**
 * Asks for a new version every hour and whenever the app is shown again, as the browser does only
 * when the app is opened: one left open for days would not learn of any. Returns how to stop.
 */
export function checkForUpdates(
  registration: { readonly update: () => Promise<unknown> },
  page: Page,
): () => void {
  const check = () => {
    // Offline, most likely: the next check asks again, so a failure is no news.
    registration.update().catch(() => undefined);
  };
  const onShown = () => {
    if (page.visibilityState === 'visible') check();
  };
  const timer = setInterval(check, CHECK_EVERY_MS);
  page.addEventListener('visibilitychange', onShown);
  return () => {
    clearInterval(timer);
    page.removeEventListener('visibilitychange', onShown);
  };
}

/**
 * Loads now the parts of the app loaded only when first used, while this window's version is
 * still the one the service worker serves. Once a new version takes over, the files of this one
 * are gone from the cache and from the server, so a window kept on it, with an own SOS open or a
 * radio linked, could not load them any more. A part already loaded stays loaded in the window.
 * The list holds every `import()` of the app (updates.test.ts checks it).
 */
export async function loadLazyParts(): Promise<void> {
  const parts = await Promise.allSettled([
    import('jsqr'),
    import('../map/tiles/ortho.ts'),
    import('@tesel/meshcore'),
    import('@tesel/meshtastic'),
  ]);
  for (const part of parts) {
    if (part.status === 'rejected') console.warn('Loading a part of the app failed', part.reason);
  }
}
