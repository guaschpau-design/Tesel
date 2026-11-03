# 0102. The ground raised in 3D, on asking

- Status: Accepted, amended by [0106](0106-ground-in-3d-that-reads.md) (shadows, a sky, leaning to 80°, height with the zoom)
- Date: 2026-11-02

## Context

Shaded relief and contour lines say how the ground lies, but reading them takes practice. Raising the ground in 3D, as ATAK does, shows at a glance a slope, a ravine or what lies behind a ridge. MapLibre raises the ground from elevation tiles, and Tesel already has them, Mapterhorn's, for the relief, the contour lines and every climb ([ADR-0024](0024-terrain-tiles-for-relief.md), [ADR-0037](0037-maps-across-borders.md)), offline too. A raised ground costs the phone more drawing, so more battery and warmth, and is slower on old phones.

## Decision

- A "3D" button among the map's controls raises the ground, 1.5 times its height so that gentle ground still shows, and leans the map back 60°; pressed again, both lie flat. Two fingers lean and turn the view as before.
- It reads the same elevation tiles as the relief, as a source of its own as MapLibre advises: nothing more to download, and it works in every downloaded area.
- It is off whenever the app opens, and a screen at rest ([ADR-0097](0097-energy-saving.md)) lays it flat.
- Everything on the map lies on the raised ground: positions, markers, areas, routes and warnings.
- With the ground raised, "North up" turns the map north without laying it flat.

## Consequences

- Drawing, measuring and marking points are still best done flat, from straight above; 3D is for reading the ground.
- Where the elevation tiles have not been loaded or downloaded, the ground stays flat.
