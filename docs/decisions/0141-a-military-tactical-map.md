# 0141. The tactical map read as a military map, by day and by night

- Status: Accepted, amended by [0144](0144-the-tactical-map-in-coyote.md) (the tactical map in coyote rather than graphite) [0145](0145-reading-the-tactical-map-as-soldiers-do.md) (MGRS, mils, magnetic north, its margin and ways over the ground) and [0147](0147-no-night-map.md) (no night map)
- Date: 2026-11-18

## Context

The tactical map (ADR-0114, ADR-0120) was the OpenStreetMap map in greys on a dark ground, made so that only what the team marks has colour. Pau asked for it to be as close to a military map as it can be, and for the topographic map to be left as it is: the arrows of ADR-0140, which he had asked for on the topographic map, belong on the tactical one.

A military map shows the shape of the ground, which water runs where, where there is cover, the points every movement depends on (bridges, hospitals, fuel), place names in capitals, and a grid whose digits are printed in its margins. Read at night, it must not dazzle eyes used to the dark: military torches and screens go red.

## Decision

The tactical map (`map/style/tactical.ts`) draws, from data Tesel already downloads for every offline area:

- **The ground's shape**: relief shading, always (the "Relieve" switch still governs the other maps), and the topographic map's contour lines with their heights, in muted greens.
- **Water**: rivers, streams and lakes in blue, streams that run dry dashed, and in Spain arrows the way they flow (ADR-0140, moved here from the topographic map).
- **Cover**: woods with a texture of dots.
- **Bridges** edged in amber.
- **Key points**: the services of the base map (health, fire, police, helipads, town halls, fuel) on amber squares with their pictograms, in place of the round coloured icons (`ServiceLook`).
- **Names** of places, water and the terrain (IGN's, in Spain) in capitals and spaced; streets keep their names as signed.
- **The MGRS grid** in cyan, switched on when a tactical map is chosen (it can then be hidden as any layer), its digits at the screen's left and bottom edges, as a map prints them in its margins, following them as the map moves (`coordinates/grid-edges.ts`).

A fifth base map, **"Nocturno"** ("Night"; first named "Táctico noche", renamed the same day at Pau's request so as not to repeat "táctico"), is the same map with every colour turned into a red of the same lightness on black (`inRed`), its grid, contours and key points red too; the map's look is `night` (`data-map-theme`).

The topographic map is as it was before ADR-0140.

## Consequences

- One map to plan and move by, read as soldiers, firefighters and rescuers trained on military maps read theirs.
- By night, the map no longer spoils the eyes' adaptation to the dark. The app's bars and panels keep their own look, and members, markers and zones keep their colours, so they stand out on it.
- The relief and contours need the elevation tiles: the tactical maps now download them as the topographic map does. Offline areas already hold them.
- Outside Spain there are no arrows on streams and no names of the terrain, as on the topographic map.
- Near the edge of a UTM zone, a digit at the screen's edge may belong to a line that ends at the zone's edge.
