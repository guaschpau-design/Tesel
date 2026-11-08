# 0016. The web app first, and Android and iOS apps built from the same code

- Status: Accepted, amended by [0124](0124-android-app-first.md) (Android first and free; iOS once Tesel pays for it)
- Date: 2026-10-25
- Supersedes: [ADR-0002](0002-pwa-only-client.md) after v0.1 (v0.1 itself ships as a web app only)

## Context

Tesel is meant for the general public, not only technical users. Three limits of a web-only client matter in an emergency:

1. **Background.** With the screen locked or the app closed, a web page stops: it neither reports the position nor warns of an SOS. In an emergency the phone is in a pocket.
2. **iPhone and radios.** No browser on iOS supports Web Bluetooth (third-party browsers such as Bluefy are a workaround for technical users).
3. **Habits.** The public looks for apps in the app stores; installing from the browser confuses people and erodes trust.

Rewriting the client natively would throw away the interface and multiply the work by platform.

## Decision

- The web app stays the main client: on computers, for anyone who does not want to install anything, and served by the server and by command posts.
- Android and iOS apps are built from the same web code inside a native shell (Capacitor), in a new `apps/mobile`. The shell adds what the web cannot do: Bluetooth on iOS, position and radio in the background, notifications for SOS calls and critical alerts with the app closed, and invitation links that open the app.
- Platform features stay behind interfaces that already exist or are added for this: `RadioLink` for the radio, an equivalent one for the position, one for notifications. Protocol, core, server and interface code do not change.
- Distribution: Google Play, the App Store and F-Droid. The web app keeps updating instantly; the store apps follow store review.
- Order: v0.1 ships as a web app (days 6 and 7), the native apps follow right after.

## Consequences

- An Apple developer account (about 99 USD a year, built on the owner's Mac) and a Google Play account (about 25 USD once) are needed.
- `apps/mobile` holds the native projects; CI builds them.
- The landing page at tesel.eu links to the stores as the apps become available.
