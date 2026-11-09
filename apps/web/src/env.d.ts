// The build settings the app reads by name (vite.config.ts): written out in the code at build time,
// so that what one build leaves out is not in it at all.

interface ImportMetaEnv {
  /** "android" in the build the Android app carries (lib/platform.ts). */
  readonly VITE_TARGET?: string;
  /** The app's version (package.json, ADR-0126). */
  readonly VITE_VERSION: string;
  /** The number of the build, as CI numbers its runs; empty outside CI. */
  readonly VITE_BUILD: string;
}
