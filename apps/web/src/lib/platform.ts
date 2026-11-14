// Which build of the app this is, as VITE_TARGET set it: the web app, served by a server or a
// static host, or the same app inside the Android app (apps/mobile, ADR-0124); and whether the
// device is held in the hand (ADR-0131).

/**
 * The app runs inside the Android app: its files come with it, so it has no service worker and no
 * updates to offer, and the screen is already the app's, with no browser bars to hide.
 */
export const IN_ANDROID_APP = import.meta.env.VITE_TARGET === 'android';

/**
 * A phone or a tablet, used by touch: pocket mode, and full screen by itself, are for these. A
 * computer, used with a mouse, keeps neither (ADR-0131); a computer with a touch screen still has
 * a mouse as its main pointer.
 */
export const HANDHELD =
  IN_ANDROID_APP ||
  (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
