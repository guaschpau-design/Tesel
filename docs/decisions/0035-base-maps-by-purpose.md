# 0035. Give each base map a purpose of its own

- Status: Accepted, amended by [0120](0120-three-base-maps-and-hazards.md) (no street map; the tactical map is the third)
- Date: 2026-10-27

## Context

The topographic map became our street map in another palette with contour lines over it (ADR-0034). Both used Protomaps' light and dark palettes almost as they come, greens included, so with the relief on they looked nearly alike in a town. Three base maps are only worth having if each answers a different question.

## Decision

- The topographic map is for the terrain: contours, names of the terrain, woods and paths (ADR-0034).
- The street map is for finding a street, a building and a way in by road: neutral land, so that members, zones and SOS calls stand out; buildings shown; roads coloured by class, motorways orange and main roads yellow; darker street names; house numbers at the closest zooms. It keeps the OpenStreetMap data of the other maps, only in a palette of its own (`map/streets.ts`), light and dark.
- The satellite map is for seeing the ground as it is (ADR-0023).
- Each palette changes only Protomaps' colours, never its layers, so that updating Protomaps keeps working.

## Consequences

- The three maps look different at a glance, and the layers panel's pictures say what each is for.
- Sizes of labels and the zoom of house numbers stay Protomaps' own; changing them would mean editing its layers, which this decision rules out.
