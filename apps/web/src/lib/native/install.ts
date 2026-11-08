// What the Android app adds to the web app (ADR-0125), installed before anything else: the first
// import of main.ts, so that the app's modules find it when they load. The web build has none of
// it: vite.config.ts builds nothing in place of android.ts there.

import { IN_ANDROID_APP } from '../platform.ts';

if (IN_ANDROID_APP) await (await import('./android.ts')).installAndroid();
