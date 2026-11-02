# 0047. Raise the alarm, and say what happened

- Status: Accepted, amended by [0070](0070-a-simpler-app.md) (only SOS calls raise the alarm), [0104](0104-sos-across-drops-and-groups.md) (calls of groups not open, each once)
- Date: 2026-10-27

## Context

The audit of 27 October 2026 found that an SOS, a critical alert or a roll call reached the screen but not the member: no sound, a vibration only while the page was visible, and nothing at all with the phone in a pocket. It also found that many actions failed in silence (a group not created, a task not saved, an offline area not deleted), that a second window of the app could leave the first waiting forever on its database, and that messages to the user came from three places that covered each other and the buttons of the incidents.

## Decision

- **Alarm.** Another member's SOS, a critical alert of the last hour and an open roll call raise the alarm once each: vibration, a short tone played three times and, while the app is hidden, a system notification that brings the app back when tapped. The tone and the notifications are switches in "More": the tone is on by default; notifications are off until the member turns them on and the browser allows them.
- **Notices.** Messages to the user go in one list of cards at the top of the map, under the incidents, so they never cover a button that asks for a tap. A notice either goes after a few seconds or stays until closed or withdrawn by what raised it (a lost location, a radio reconnecting, an update waiting).
- **Failures are said.** A form keeps what was typed and says it could not be sent; a button that fails says so in a notice. Both go through one helper (`ui/submission.svelte.ts`).
- **Storage held by another window** is said in a dialog with a button to reload, instead of an empty screen.
- **An update never interrupts an SOS.** The offer to update waits while an own SOS is open.

## Consequences

- A member with notifications on is woken by the group's emergencies even with the app in the background, as far as the browser allows; iPhone browsers without notification support only vibrate and sound while open.
- Notices replace the earlier toast and the update banner: there is one way to tell the user something.
