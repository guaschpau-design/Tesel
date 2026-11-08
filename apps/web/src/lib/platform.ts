// Which build of the app this is, as VITE_TARGET set it: the web app, served by a server or a
// static host, or the same app inside the Android app (apps/mobile, ADR-0124).

/**
 * The app runs inside the Android app: its files come with it, so it has no service worker and no
 * updates to offer, and the screen is already the app's, with no browser bars to hide.
 */
export const IN_ANDROID_APP = import.meta.env['VITE_TARGET'] === 'android';
