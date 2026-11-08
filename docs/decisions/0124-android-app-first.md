# 0124. The Android app first, free, built from the web app

- Status: Accepted
- Date: 2026-11-08
- Amends: [ADR-0016](0016-web-app-and-native-shells.md)

## Context

ADR-0016 planned Android and iOS apps built from the web app inside a native shell (Capacitor), for what a web page cannot do: work with the screen off, reach radios by Bluetooth on iPhones, and warn of an SOS with the app closed. Two facts set the order.

- **Cost.** Google Play costs about 25 USD once. The App Store costs about 99 USD a year and a Mac. The iPhone app waits until Tesel brings in money. Until then iPhones keep the web app, with the Bluefy browser for radios, and keep the screen on with the screen at rest (ADR-0097).
- **Price.** Charging for the app would stop invitations from spreading: a coordinator's volunteers would each pay. It would also charge for what makes an SOS arrive with the phone in a pocket. The app is free, with nothing held back; organisations pay for the professional offer around it.

## Decision

**Android first, in `apps/mobile`**, a Capacitor 8 project that carries the web app:

- **The web app built for it.** `pnpm --filter @tesel/mobile web` builds `apps/web` with `VITE_TARGET=android`, the server and base map at tesel.eu, and invitations pointing to `https://tesel.eu/app/`. `cap sync` copies it into the Android project. The interface, the protocol and the server do not change: the server already answers apps on other origins.
- **Served from the app's own files**, at `https://app.tesel.eu`. Capacitor answers that host inside the app, and it never reaches the network. It is not a loopback host, so invitations to a server on the device are refused as in a browser (ADR-0110).
- **What the browser does, the app does without.** No service worker and no update prompt: the app updates as a whole, from its store. No browser full screen: the screen is the app's.
- **Invitation links open in the app.** Android hands `https://tesel.eu/app/join` links, from a QR code or a message, to the app, which opens its join path with the token (`MainActivity`). The link is verified, and opens without asking, once tesel.eu publishes the signature of the app on Google Play in `/.well-known/assetlinks.json`. Whoever has no app opens the same link in the browser, as today.
- **Permissions:** the internet, the location, the camera for QR codes, and vibration. **No backups:** a group's secret and the device's identity stay on it, as in a browser.
- **Icons** from the mark, by the same script as the web icons (`apps/web/scripts/render-icons.js`): square and round ones, and the mark alone for the shapes of Android 8 and later.
- **Test builds.** CI builds an APK on every run and keeps it two weeks, to install by hand. It is signed with a test key that is public, in the repository, so that each build installs over the last, numbered by the run. Builds for Google Play will be signed with a key kept out of the repository, under Play App Signing.

**Next, in this order:** the position and the group in the background, with Android's ongoing notification; Bluetooth to nodes from the app itself; and notifications of an SOS or a task with the screen off.

## Consequences

- For now the app does what the web app does in Chrome, with the app's icon and invitations that open in it.
- Some things are missing until the native parts arrive:
  - Android's web view has no Web Bluetooth, so nodes are linked from the browser until the app links them itself.
  - It has no dictation, no browser notifications and no share sheet.
  - The server's anonymous usage figures (ADR-0117) do not count the app, which loads no page from it.
- Each change to the web app reaches the Android app with its next build.
- The app's list of third-party licences comes from the web app and does not yet name the native libraries it carries: Capacitor (MIT) and AndroidX (Apache-2.0). It will before the app goes to Google Play.
- Anyone can build an APK signed with the test key. Test builds are only for trying the app, never for users, and the published app's links are verified against the Google Play key only.
