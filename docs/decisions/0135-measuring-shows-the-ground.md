# 0135. Measuring shows the ground; no "Ir a una coordenada"

- Status: Accepted
- Date: 2026-11-15

## Context

The "More" menu held "Ir a una coordenada", a panel where a dictated coordinate was typed to see its point on the map (ADR-0021). Since ADR-0077, a coordinate dictated over the radio is typed where it is used, a marker or a task's place, so the panel had become a second way to the same thing. Pau asked to remove it.

The measuring tool gave the length of a path and the area it encloses, but not how much it climbs, which the panel of a point already shows for the straight way to it (ADR-0115). On foot, a path's climb matters as much as its length.

## Decision

- **"Ir a una coordenada" is gone**, with its panel. A dictated coordinate is typed as a marker or as a task's place (ADR-0077); a long press still shows a point's coordinates, in the format chosen. This amends ADR-0021.
- **Measuring shows the ground.** A "Desnivel" button on the measuring card shows, on asking, the elevation profile of the path tapped so far, as a point's panel draws that of the way to it: the start at the left, the end at the right, how much it climbs and descends and its steepest stretch. Hidden again, the climb stays on the line of the length. The path is read only once asked, or with the relief on, as for a point (ADR-0115).
- One way to sample a way: `samplesAlong` takes a path, evenly along it through its corners; the straight way to a point is a path of two points. `WayClimb` follows any path.

## Consequences

- The "More" menu has one item fewer.
- A route walked out on the map says how hard it is before anyone sets off.
- A coordinate can no longer be looked at on the map without leaving something there; a marker can be deleted afterwards.
