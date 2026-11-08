# 0125. The Android app with the screen off: native location, Bluetooth and notifications

- Status: Accepted
- Date: 2026-11-08

## Context

The Android app (ADR-0124) carries the web app as it is. Inside Android's web view, though, three things fail:

- **Bluetooth.** The web view has no Web Bluetooth, so radios cannot be linked.
- **The screen off.** When the screen goes off the app is in the background. Android may stop it, and a web view's location does not reach an app in the background.
- **Notifications.** The web view has none, so an SOS goes unnoticed while the app is not on screen.

## Decision

**The Android app supplies the browser APIs the web app already uses**, over native code, before the app starts (`apps/web/src/lib/native`). The rest of the web app does not change, and the web build has none of it: `install.ts` is the first import of `main.ts`, and in the web build `vite.config.ts` puts nothing in place of what it loads.

| Browser API             | In the Android app                                                                                                                             | What it gives                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `navigator.geolocation` | Android's location (`LocationWatch.java`): its fused provider from Android 12, without Google's services; before that, the GPS and the network | Fixes with the screen off                                                              |
| `navigator.bluetooth`   | `@capacitor-community/bluetooth-le`                                                                                                            | MeshCore and Meshtastic radios linked as in Chrome, and kept with the screen off       |
| `Notification`          | Android's notifications (`Notices.java`)                                                                                                       | An SOS that sounds as an alarm and vibrates, shown only while the app is not on screen |

**The app keeps running with the screen off while it has something to do there** (`ActiveService.java`): while something uses the location (sharing the position, guiding, a danger area) or a radio is linked. Android's ongoing notification says which. It runs only as far as the permissions given allow: for the location if it may use it, for Bluetooth if it may connect. With neither, nothing keeps the app running, and it stops in the background as a web page does. Closing the app from the recent apps stops it. Each fix keeps the processor awake five seconds, so that the web app sends it. The web view's page is kept as an app's on screen is, so that Android does not end it to free memory.

`TeselDevicePlugin.java` is the one native plugin of the app's own. It asks for the location and the notifications when the web app first needs them, as a browser would.

## Consequences

- With the app open and the screen off, the position is shared, the radio stays linked and an SOS sounds. A web page in a browser does none of this.
- Nothing of it could be tried on a phone before it was published. The tests check the web side against stand-ins for the plugins, and CI checks that the app builds. Some things are known only on a phone: how each make of phone treats an app running with the screen off, and the battery it takes.
- A member not sharing their position and with no radio linked keeps the web app's limits: in the background, nothing arrives until they open the app. Notifications that reach a closed app would need a push service. That is another decision.
- Google Play asks for a reason and a video for the location used with the screen off (ADR-0124 lists what precedes the store).
- The app depends on one more library, under the MIT licence, which is pinned.
