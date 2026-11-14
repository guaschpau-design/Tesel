# 0130. A phone held sideways

- Status: Accepted
- Date: 2026-11-14

## Context

Tesel is made for a phone held upright, but a phone is turned sideways in a vehicle mount, on a table at a command post or to see more of the map. Held so, the screen is wide and very low: on an iPhone in Safari the map gets under 300 pixels of height. The dock and the SOS button kept to the bottom, the map's controls ran down the right side into the dock and covered "Más", the scale and the credits sat over other things, and a panel took the whole width and most of the height, so the map was gone.

## Decision

When the screen is wider than tall and at most 32 rem (512 px) high, `@media (orientation: landscape) and (max-height: 32rem)`, the same query in every part that changes for it:

- **The dock is a rail down the left edge**, its buttons with their pictograms only, a finger's size (the words stay their names for screen readers). Its menus open to its right.
- **The SOS button stays at the foot of the map, by the rail**: under it when there is room, beside it when there is not. It is never covered.
- **The map's controls keep their column at the right**, with the whole height for them; the scale goes beside them, at their foot.
- **A panel is a sheet at the right**, as high as the map, between the rail and the SOS button on the left and the controls on the right; the map stays in view at its left.
- **Cards and the map's credits keep clear of the rail and the SOS button** (`--side-clearance`); nothing sits at the bottom of the map (`--dock-clearance`).
- **The top bar is lower**: the group's name on one line, without "Grupo" above it.

A tablet or a computer, taller than 32 rem, keeps its layout. A test (`e2e/sideways.e2e.ts`) checks at 750 × 300 and 844 × 390 that the rail, the SOS button, the controls and the scale cover nothing, and that a panel covers none of them but the scale.

## Consequences

- Held sideways, the map keeps most of the screen and a panel and the map can be read side by side.
- On the rail the dock's buttons have no words: their pictograms must be known from the phone held upright.
