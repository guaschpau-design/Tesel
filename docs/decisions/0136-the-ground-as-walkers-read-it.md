# 0136. The ground as walkers read it

- Status: Accepted
- Date: 2026-11-15

## Context

Pau compared Tesel's topographic map with OpenStreetMap's own map (its "Standard" style, OSM Carto), as the MeshCore app shows it, and found the latter far easier to read in the hills. Both draw the same OpenStreetMap data. What OSM's map does that ours did not: tracks and footpaths each in a look of their own (brown dashes, red dots), streams that run dry dashed, small trees over woods, huts with a sign. Ours drew every way off the streets as one thin brown line, streams half a pixel wide and woods as flat green.

OpenStreetMap's own tiles cannot serve Tesel: their usage policy forbids offline use and downloading areas ahead ("Offline use is not permitted"), offers no guarantee, and may block an app without notice. The data is already ours, in the Protomaps base map we serve (ADR-0007).

## Decision

The topographic map draws, from the Protomaps base map and in OpenStreetMap's conventions (`map/style/trails.ts`):

- **Tracks** (`kind_detail` track) in brown dashes; **footpaths** (paths, bridleways, cycleways off the streets) in red dots; **steps** in short red bars; all on a light edge that keeps them readable over woods and contour lines, from zoom 13. Pavements and pedestrian streets keep the base map's thin line, so towns are not covered in dots.
- **Rivers and streams** in a clear blue, those that run dry (`intermittent`) dashed.
- **Small trees** over forests and woods, from zoom 13.
- **Mountain huts and shelters** with a sign (the app's house pictogram) and their name.

The images (trees, the hut's sign) are made by the app (`terrain-images.ts`) and added as each style loads, before its tiles are laid out.

Not drawn, because the base map does not carry them: power lines, the grade of a track, the height written by a hut or peak. They would need a base map built by us, a project of its own.

## Consequences

- In the hills, which way is a track and which a footpath, where water runs and where the wood is read at a glance, offline as online.
- The base map's look changes for the topographic map only; the tactical map and the photographs keep theirs.
