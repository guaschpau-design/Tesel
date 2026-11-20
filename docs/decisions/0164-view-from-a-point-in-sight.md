# 0164. What a point sees, in sight

- Status: Accepted
- Date: 2026-11-20

## Context

«Qué se ve desde aquí» (ADR-0152) draws in green, within 2 km, the ground in sight from a point. On a phone, the point's panel stayed open over most of the map, with the green under it; its «Quitar» button, squeezed beside the line that explains the green, broke into letters.

## Decision

- **While what a point sees is shown, its panel shrinks to that line** and two buttons: «Quitar», which hides it, and «Ver el punto», which opens the whole panel again (distance, the way there, marking, coordinates) with the green still on the map. Shown anew, it shrinks again.
- **The map frames the 2 km around the point in the part no panel covers** (`showAround`, `map/geometry.ts`): above the panel on a phone, beside it on a wide screen, once the panel has shrunk.
- In the whole panel, «Quitar» goes under the line, never squeezed beside it.

## Consequences

- The green is seen at once, without closing the panel or moving the map by hand.
- The map moves to show it, leaving the view where the user had it.
