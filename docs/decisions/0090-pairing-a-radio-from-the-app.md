# 0090. Pairing a radio from the app, and saying why a connection failed

- Status: Accepted
- Date: 2026-11-01

## Context

The first test with real radios (two Seeed Studio XIAO ESP32-S3 with Wio-SX1262, MeshCore Companion Bluetooth v1.18, an Android tablet with Chrome) failed: the browser listed the radio, and twenty seconds later the app said only "Could not connect to the radio". The system never asked for the radio's PIN.

MeshCore's Bluetooth serial service needs an encrypted, authenticated link for both its characteristics (`SerialBLEInterface`: read and write with MITM protection), which only pairing with the radio's PIN gives. A web page cannot pair: the system asks for the PIN when something protected is accessed. meshcore.js's Web Bluetooth transport only enabled notifications, which the radio allows unpaired, and then wrote, which an unpaired link refuses; it swallowed the refused write, so the first command waited forever and the app's twenty-second limit was all the user saw. Chrome on Android does not start pairing on a refused write. Pairing the radio in Android's Bluetooth settings first, then switching the radio off and on, made it work; for a user, that sequence is far too much to guess.

## Decision

- Tesel opens the radio with a Bluetooth transport of its own (`packages/meshcore/src/web-ble.ts`), extending meshcore.js's `Connection` as the library intends; the companion commands are still the library's.
- Before anything else it reads the radio's outgoing characteristic, which is readable but protected: the read is what makes the system ask for the PIN the first time, inside the connection, and it answers at once once paired. A radio whose characteristic cannot be read is paired on the first write instead.
- Each step has a time limit and a failure of its own: the Bluetooth connection (15 s), the PIN (60 s for the user to type it) and the radio's first answer (5 s). A write the system refuses rejects its command at once instead of being swallowed.
- A connection that fails says why. A missing pairing (`RadioError` `not-paired`) shows the three steps to pair in the system's settings, the one thing the user must do outside Tesel; silence from a paired radio keeps the message about its firmware; anything else asks to check that the radio is on, nearby and not used by another app. Under the button a line says the factory PIN, 123456, and what to do when the radio is not listed: switch it off and on, since a radio another device holds stops advertising.
- The app does not try to remember the radio and reconnect to it when it starts: the Web Bluetooth call that would allow it, `getDevices()`, is still behind a flag in Chrome. Within a session, a dropped radio is reconnected as before.

## Consequences

- On systems that ask for the PIN when a protected characteristic is read, connecting a new radio is: tap "Connect radio", pick it, type the PIN once. Whether Chrome on Android asks this way is to be confirmed with a radio not yet paired; if it does not, the app now says so in seconds and shows the steps.
- Fully automatic pairing, the PIN typed by the app itself, is possible only in a native app (ADR-0016).
