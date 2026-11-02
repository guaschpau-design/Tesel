# 0105. Keep circles to 1 000 km, and their points on the Earth

- Status: Accepted
- Date: 2026-11-02

## Context

A `SHAPE` circle carried any radius from 1 m up to the limit of a `u32`, about 4 300 000 km (protocol §3.7). The app turns a circle into points by stepping north and east from its centre on a flat plane (`offsetMeters`), to draw its ring and to find the corners of an operation area, which the map then frames. A large radius, or a modest one near a pole (1 000 km around 85° N), gave latitudes past ±90°. MapLibre throws at such a latitude, and it did so inside the effect that frames the group at start, so one member's circle broke the map on every device of the group.

## Decision

- **A largest radius on the wire.** A circle's radius is at most 1 000 000 m (`MAX_CIRCLE_RADIUS_M`). Encoders refuse a larger one; decoders discard the event, as for a radius of 0. A circle 1 000 km in radius takes in the whole Iberian Peninsula: no operation of a group is larger, and the limit leaves plenty of room above what anyone draws. A lower limit, tens of kilometres, would refuse a large flood or a regional exercise for no gain.
- **Points stay on the Earth.** The limit alone does not keep a circle near a pole from reaching past it, so `offsetMeters` stops a latitude at the pole and a longitude at half a turn east or west of the centre, which keeps a ring in one piece, and `boundsAround` keeps bounds within ±90° and ±180°.
- **Framing that cannot throw.** The map is framed through one helper, `fitPoints`, which does nothing for bounds that are no place on the Earth (a coordinate that is not a number), instead of passing them to MapLibre.

## Consequences

- A circle drawn by a newer or a foreign client with a radius over 1 000 km is not shown; until v0.1.0 the protocol changes in place (§9).
- Near a pole, circles are drawn flattened against it. Nobody operates there with Tesel, and a ring that stays a valid shape matters more than one that is exact.
- No out-of-range latitude reaches MapLibre from a circle, and a bad point leaves the map where it is instead of breaking it.
