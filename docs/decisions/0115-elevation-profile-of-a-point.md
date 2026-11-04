# 0115. The elevation profile of the way to a point, on asking

- Status: Accepted
- Date: 2026-11-04

## Context

A point on the map, a marker or a member says how far it is and which way. How much the way there climbs and descends was shown only with the relief on, as one line, because reading it downloads elevation tiles (ADR-0048). Someone deciding whether to walk to a point wants to see the ground in between, not only a number: where it climbs, where it drops, and by how much.

## Decision

- **An "Elevation" fold under the distance**, wherever a point's distance is shown in a panel (a point of the map, a marker or shape, a member). Closed, it reads nothing. Opened, it reads the elevations along the straight way from this device to the point and draws them. From then on, closed, it shows the gist: metres up and down. With the relief on, the gist is there from the start, since its tiles are read anyway.
- **The profile is drawn to scale.** The ground is a line over the distance, filled below. Round heights are marked across it, from one level below the lowest point to one above the highest, never less than 20 m apart top to bottom so that flat ground does not look steep. "You" is at the left and the distance at the right. Below it are metres up, metres down and the steepest stretch, as the guidance card gives them. Where heights are stretched against the distance by half as much again or more, it says by how much ("Height exaggerated ×3").
- **Opening the fold is the asking.** The app keeps a second elevation reader, `terrain.onDemand`, there as soon as elevations can be read; `terrain.reader` stays null while the relief is off, so nothing else reads elevations by itself.
- The way is read again when the device has moved 25 m or the point changes, as for the guidance card. Both share `terrain/way-climb.svelte.ts`. Cards on the map (an SOS call) keep the one line, with the relief on: there is no room for a fold.

## Consequences

- Seeing the climb no longer needs the relief switched on; it needs only the fold opened, and elevation tiles online or downloaded with a map. Without them, the fold says so.
- The way is straight, not a path: it tells what lies between, not how a trail winds through it.
- The browser tests serve elevation tiles made as they are asked for (`e2e/terrain-ramp.ts`): ground rising northwards with no step between tiles.
