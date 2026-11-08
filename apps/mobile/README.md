# Tesel for Android

The Android app: the web app (`apps/web`) built for it and carried in a Capacitor project, with what Android does natively for it ([ADR-0124](../../docs/decisions/0124-android-app-first.md)).

| Path                                            | What                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `capacitor.config.json`                         | The app's identity (`eu.tesel.app`) and the host its files are served at (`app.tesel.eu`)         |
| `package.json`                                  | `web` builds the web app for the app into `www/`; `sync` builds it and copies it into the project |
| `android/`                                      | The Android project, made by Capacitor and kept here                                              |
| `android/app/src/main/AndroidManifest.xml`      | Permissions, and the invitation links the app opens                                               |
| `android/app/src/main/java/…/MainActivity.java` | The app's screen; opens invitation links at the web app's join path                               |
| `android/test-signing.p12`                      | The public key test builds are signed with (password `tesel-test`): never for published builds    |

The launcher icons are rendered from the mark with the web icons: `pnpm --filter @tesel/web icons`.

## Building

CI builds the APK on every run (`android` job in `.github/workflows/ci.yml`) and keeps it two weeks, as an artifact named `tesel-android-<run>`. To build it locally, with Java 21 and the Android SDK:

```sh
pnpm install
pnpm --filter @tesel/mobile sync
cd apps/mobile/android && ./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

## Trying it on a phone

1. Download the artifact of a run from the repository's Actions tab, and unzip it: it holds `app-debug.apk`.
2. Open the APK on the phone and allow installing apps from that source when Android asks.
3. A later build installs over this one, keeping its groups.

Until the app is on Google Play, Android does not open invitation links in it by itself: in the app's settings, under _Open by default_, add `tesel.eu`.
