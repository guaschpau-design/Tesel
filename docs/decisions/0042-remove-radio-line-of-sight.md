# 0042. Remove the radio line of sight

- Status: Superseded by [0159](0159-radio-link-over-the-ground.md)
- Date: 2026-10-27

## Context

«Visión radio» (ADR-0032) checked from any point of the map whether the terrain let a LoRa signal reach another point or this device. The project's owner decided to take it out of the app.

## Decision

- The tool goes: its action in a point's panel, its card and its line on the map, the check itself and its tests.
- What it shared with the rest stays: the elevation reader and its tiles, which the relief, the contour lines and the climbs of a way still use.
- This supersedes ADR-0032.

## Consequences

- The elevation tiles are read only for the relief, the contour lines and the climbs; nothing asks for them on request any more.
- Choosing where to stand or where to raise a repeater is left to dedicated radio planning tools.
