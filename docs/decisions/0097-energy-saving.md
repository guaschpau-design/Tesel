# 0097. Save energy with a screen at rest and the GPS at intervals

- Status: Accepted
- Date: 2026-11-02

## Context

A web app stops when the phone locks its screen: the position is no longer shared, nothing arrives and a radio bridge drops. So Tesel has to stay open during an operation, and an open map with the GPS on drains a phone in a few hours. The browser cannot turn the screen off or dim it, and it has no background mode until the native apps (ADR-0016).

## Decision

- **Energy saving**, a switch in Settings, on by default. While it is on the app keeps the screen from locking, so it goes on working.
- **At rest, after 1 minute untouched**, a black screen covers the app: the time, how the device is linked to its group and "Tap to come back". Black lights no pixel of an OLED screen. While guiding, it shows the way to go, an arrow and the distance, in large. Any touch brings the app back as it was. Nothing rests while something is being typed or drawn, a tool is in use, the SOS dialog is open or the device's own SOS is open.
- **Deep at rest, after 10 minutes untouched**, the GPS runs once a minute: on until it has a good fix (20 m) or for 20 seconds, then off, the last fix kept (`DeviceLocation.pace`). It stays on while guiding and while this device's SOS is open. Everything else, chat, alerts, tasks and the radio, works as before.
- **What wakes the screen**: an SOS of someone else (with its alarm), a task handed to this device or its team, entering a danger zone and the safety check-in, each with a vibration and a tone. A chat line only vibrates, so that a busy chat does not keep the screen lit.

## Consequences

- A phone left on the table or in a pocket lasts much longer with the app open; on LCD screens (many cheap tablets) the black screen saves less, as their backlight stays on.
- With the switch on, the screen never locks by itself while Tesel is open; a user who wants it to lock turns the switch off.
- At deep rest, positions reach the group once a minute at most, and trails are coarser.
- iPhones do not vibrate from a web page: there, what wakes the screen does so with the tone only.
