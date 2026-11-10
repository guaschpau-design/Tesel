# 0127. Pocket mode, and telling an SOS outside Tesel from the call itself

- Status: Accepted
- Date: 2026-11-09
- Amends: [ADR-0097](0097-energy-saving.md), [ADR-0122](0122-zone-crossings-and-telling-outside.md)

## Context

The black screen that saves energy (ADR-0097) came only by itself, after a minute untouched. Any touch took it away, a hand in a pocket included, and its name ("Ahorro de energía") did not say what it was.

Telling someone without Tesel (ADR-0122) sat in Me, apart from the moment it is needed: a call for help. It also offered four ways to send, where the phone's share menu already lists them all. And it said an SMS reaches 112. In Spain it does not, in general. What does reach it is a call: the phone sends its position with it (Advanced Mobile Location).

## Decision

**Pocket mode** (`power/`):

- **It comes at once** from a padlock, the last of the map's controls, or by itself after a minute untouched if the switch in Settings, «Modo bolsillo automático», allows it (on by default, as before).
- **A touch does nothing.** Only sliding the handle at the foot to the end of its track brings the app back (`SlideOut.svelte`). From the keyboard, Enter on the handle does it. A touch shows how to leave, a moment brighter.
- **It shows little:** the time and how the device is linked, and the way while guiding.
- **What must be seen still ends it** (ADR-0097): another member's SOS, a task handed over, a danger area entered, the check-in.
- While it lasts, the screen is kept from locking, so that the app goes on working. Ten minutes untouched, the GPS goes to a fix a minute, as before. On an iPhone the browser grants that only right after a touch, the first time: asked for when the app opens, it is refused, so it is asked for again at the next touch (`ui/screen-awake.svelte.ts`). Nothing keeps a web page working once the screen is turned off with the side button.

**Telling an SOS outside Tesel, on the call's card** (`incidents/SosOutside.svelte`):

- **One's own call:** «Llamar al 112», a link that opens the phone's dialer with 112, and «Enviar mi ubicación».
- **Someone else's:** «Enviar su ubicación».
- **Sending** opens the phone's share menu, where the user picks WhatsApp, SMS or any other app. Where there is none (a computer), the text is copied, and the app says so. The Android app opens Android's own menu.
- A call whose place is not known yet is sent all the same, saying so.
- Me no longer offers it.

## Consequences

- A phone can go into a pocket with Tesel open, and nothing in the pocket changes anything on it.
- Leaving pocket mode takes a deliberate gesture, which a glance at the screen does not need.
- The SOS card holds what to do next. 112 is a call, as rescue services ask, and messages go to the people the caller chooses.
