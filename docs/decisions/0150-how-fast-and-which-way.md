# 0150. How fast and which way: the movement indicator, and the radar with the tactical map

- Status: Accepted
- Date: 2026-11-19

## Context

ADR-0148 drew an arrow, always the same length, out of each moving member's symbol on the tactical map. Pau approved two things from SitaWare and ATAK: the arrow's length telling the speed, so that who walks and who drives tell apart, and the rings round this device, which Tesel has as its radar (`radar/`), on by default with the tactical map.

## Decision

- **The movement indicator** (`objects/app6-movement.ts`): a black line on a white edge, out of the symbol the way it moves, ending in an arrowhead where it will be in a minute at its speed. Shorter than 40 pixels it would hide under the symbol, so it reaches at least that far; without a speed it only points. It replaces ADR-0148's fixed arrow, and is drawn under the symbol.
- **This device's** follows the GPS's way and speed while it moves at half a metre a second or more; standing, the compass's way, pointing only. ADR-0148 put the compass first; but moving, where it goes counts more than where the phone points.
- **The radar comes with the tactical map**, as the MGRS grid and mils do (ADR-0145), and can be turned off again in Layers. It keeps the GPS on while shown.
- The map's zoom, which the indicator and the radar's rings follow, is read in one place (`map/zoom.svelte.ts`).

## Consequences

- A member in a vehicle at 50 km/h shows a line of some 800 m: at a glance, who will be where in a minute.
- On foot, the line is mostly its least length: as ADR-0148's arrow was.
- Choosing the tactical map uses a little more battery, for the radar's GPS.
