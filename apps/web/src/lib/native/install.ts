// What the Android app adds to the web app (ADR-0125), installed before anything else: the first
// import of main.ts, so that the app's modules find it when they load. The web build has none of
// it: vite.config.ts builds nothing in place of android.ts there. If any of it fails, the app
// starts all the same, with what the web view has.

import { IN_ANDROID_APP } from '../platform.ts';

if (IN_ANDROID_APP) {
  try {
    await (await import('./android.ts')).installAndroid();
  } catch (error) {
    console.error('What the Android app adds could not be installed', error);
  }
}
