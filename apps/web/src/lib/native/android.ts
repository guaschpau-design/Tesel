// What the Android app supplies the web app with (ADR-0125): the browser APIs it uses that an
// Android web view lacks, or stops with the screen off, over native code, and keeping the app
// running while it has something to do with the screen off. Loaded only in the Android build
// (install.ts), before the app reads any of these APIs.

import { BleClient } from '@capacitor-community/bluetooth-le';

import { detectLocale, translator, type Locale } from '../i18n/index.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import { radio } from '../radio/radio.svelte.ts';
import { keepRunningWhile } from './keep-running.svelte.ts';
import { NativeBluetooth } from './native-bluetooth.ts';
import { NativeGeolocation } from './native-geolocation.ts';
import { nativeNotification } from './native-notification.ts';
import { teselDevice } from './tesel-device.ts';

/** Stands in for the browser's APIs, then follows what keeps the app running. */
export async function installAndroid(): Promise<void> {
  standIn(navigator, 'geolocation', new NativeGeolocation(teselDevice));
  standIn(navigator, 'bluetooth', new NativeBluetooth(BleClient));
  standIn(window, 'Notification', await nativeNotification(teselDevice));
  standIn(navigator, 'share', (data: ShareData) =>
    teselDevice.share({ text: [data.text, data.url].filter(Boolean).join('\n') }),
  );
  keepRunningWhile(
    teselDevice,
    () => ({ located: deviceLocation.inUse, linked: radio.linked }),
    () => translator(appLocale()),
  );
}

/** Puts `value` where the web app looks for a browser API. */
function standIn(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, { value, configurable: true });
}

/** The language the app shows (App.svelte sets it on the page), or the phone's. */
function appLocale(): Locale {
  const shown = document.documentElement.lang;
  return detectLocale(shown ? [shown] : navigator.languages);
}
