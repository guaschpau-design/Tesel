# 0123. Draw only what is seen, and send on foot less often

- Status: Accepted
- Date: 2026-11-08

## Context

Saving energy (ADR-0097) darkens the screen and spaces out the GPS, but four things still spent a phone's battery for nothing:

- **The map was drawn under the black screen.** Every position that arrived, and every refresh of members' freshness, redrew it, though no one could see it.
- **It was drawn at the phone's full density.** Phones with three pixels per point draw more than twice as many pixels as at two, with no visible difference on a map.
- **This device's dot was drawn on every GPS fix**, about once a second, even when it had not moved a pixel. While the map followed it, every fix also started a short animation of the whole map.
- **On the move, a position went out every 5 seconds.** After each send the phone's modem stays awake for several seconds, so at that pace it never rests.

## Decision

- **At rest, the map waits.** While the screen at rest covers the app, our layers take in no new data. On waking, each takes what it is then and the map is drawn once. Tiles and the camera are left alone. Anything important wakes the screen (ADR-0097), and so it is drawn.
- **At most two pixels per point.** The map is drawn at the device's density up to 2 (`MapView.svelte`).
- **This device's dot is drawn when it changes on screen:** when it moves by a pixel or more, or its accuracy circle grows or shrinks by a pixel or more, and after each zoom (`drawnAlike`). Following this device, the map moves only for a fix 3 pixels or more off its centre, and not at rest.
- **On foot, a move goes out every 15 seconds at most** (`report-policy.ts`). Faster than 2.5 m/s (9 km/h), running or in a vehicle, it is still 5 seconds. A sharper fix of the same place, the heartbeat and an SOS are unchanged.

## Consequences

- Nothing a member does changes. A woken screen shows the group as it is, with no frames in between.
- Others see a walker's position up to 15 seconds late, which is about 20 metres. Trails and sweeps are drawn from the same moves, with their points further apart. The lines between them are what count, so the parts swept come out the same.
- On a phone of three pixels per point, lines and text on the map are a little less sharp up close.
- This amends ADR-0097, whose screen at rest no longer has the map drawn underneath.
