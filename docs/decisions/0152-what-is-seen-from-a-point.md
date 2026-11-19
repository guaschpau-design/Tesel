# 0152. What is seen from a point

- Status: Accepted
- Date: 2026-11-19

## Context

ATAK shows what can be seen from a place (its viewshed): from this ridge, is the gully in sight? Pau asked for it. It is a relative of «Visión radio» (ADR-0032), which he had removed (ADR-0042): that one was for the radio; this one is for the eye.

## Decision

- **«Qué se ve desde aquí»** in a point's panel (`PointPanel`), under its actions, whose room goes to marking and tasks. The map then shades, within 2 km, the ground in sight in green and the rest darker, while the point's panel is open or until «Quitar».
- It is worked out on the device from the elevation tiles the relief and the profiles use (`terrain/viewshed.ts`), offline in downloaded areas: along 360 rays, a stretch every 25 m is in sight when the slope up to it from an eye 1.7 m above the point is at least as steep as to every stretch before it, with the earth's curve and the air's bending of the light.
- The panel says it is by the lie of the land: buildings and trees are not counted, as the elevation tiles do not have them. Without the point's elevation, it says why nothing is shown.

## Consequences

- An answer in a moment, anywhere with elevation tiles, without a network.
- Seen is not certain: a wood or a building can hide what the ground does not. At 2 km and the tiles' resolution (some 15 m), small folds of the ground are missed.
