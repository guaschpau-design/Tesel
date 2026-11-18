# 0140. Which way streams flow, on the topographic map

- Status: Accepted, amended by [0141](0141-a-military-tactical-map.md) (the arrows are on the tactical map, not the topographic one)
- Date: 2026-11-18

## Context

Pau saw military-style topographic maps (T.REX ARMS' map server) and asked for three of their marks on Tesel's topographic map, if the data we use carries them: power lines, spot heights and which way rivers flow. ADR-0136 had already found that the Protomaps base map carries neither power lines nor the height of a peak, and its schema keeps no direction for a river's line.

IGN's vector map of Spain (Mapa Base), which the topographic map already reads for the names of the terrain and the cadastre's buildings (ADR-0034, ADR-0139), was checked layer by layer:

- **Power lines**: none. Its `construccion_lin` layer holds walls, cable cars, bridges and tunnels.
- **Spot heights**: none. Mountains and geodesic vertices come as names (`nombre_orografia_pto`, `nombre_poblacion_construccion_pto`) without a height.
- **Watercourses** (`hidrografia_lin`, class `curso_natural`) **are drawn downstream**: of 397 streams across ten areas of Spain, from the Pyrenees to Sierra Nevada, whose direction could be told from the contour lines they cross, every one ran from higher to lower contours.

## Decision

- The topographic map draws a small blue chevron along each natural watercourse, every 180 px, pointing the way it flows, from IGN's `hidrografia_lin`, from zoom 14 (`flowLayer`, `map/style/trails.ts`). Canals and pipes get none.
- The arrow is made by the app (`terrain-images.ts`) on a light edge, so it holds over the stream's line and the woods' trees, and it gives way to any name.
- It is read from the IGN tiles the topographic map already downloads for offline use (to zoom 16, ADR-0139): nothing more to download.
- Power lines and spot heights are not drawn: no source we use carries them.

## Consequences

- In Spain, which way a stream runs is read at a glance: the way down a ravine, where a lost person following water ends up.
- Outside Spain no arrows are drawn: the OpenStreetMap map does not keep the direction.
- IGN's line of a stream and OpenStreetMap's may lie a few metres apart, so an arrow may sit just beside the blue line rather than on it.
- Power lines or spot heights would need a base map built by us, or heights worked out from the elevation tiles, each a decision of its own.
