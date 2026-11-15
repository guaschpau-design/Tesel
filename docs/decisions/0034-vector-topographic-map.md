# 0034. Draw the topographic map from vector data, and shade the relief from IGN's terrain model

- Status: Accepted, amended by [0037](0037-maps-across-borders.md) (contours and shading from Mapterhorn) and [0136](0136-the-ground-as-walkers-read-it.md) (tracks, footpaths, streams, woods and huts as walkers read them)
- Date: 2026-10-27

## Context

The topographic base map was IGN's Mapa Topográfico Nacional as served by its raster WMTS (ADR-0023): scanned sheets at several scales, one per range of zooms. At some zooms it is a sheet drawn for another scale, enlarged or shrunk, and pixelated. Its labels are huge or too small, its colours belong to paper, and it has no dark version. Its raster tiles had to be downloaded three zooms deeper than the street map.

The national mapping system (SCNE) also publishes the Mapa Base, a vector tile service of all Spain under CC BY 4.0. Its layers include the official contour lines (`altimetria_lin`, each with its height, 5 or 10 m apart as each region's source has them) and the names of the terrain (`nombre_orografia_pto`: mountains, ranges, places, ravines, caves) and of springs. IGN's own style for that map shades the relief from elevation tiles of its terrain model, served at `xyz-mdt.idee.es` in the Mapbox Terrain-RGB encoding, 512 pixels wide, much finer than the Terrain Tiles (ADR-0024). That endpoint is not in IGN's service catalogue; it is used by IGN's published style.

## Decision

- The topographic map is our street map in a topographic palette (woods and scrub greener, tracks and paths brown), with IGN's contour lines and their heights, and its names of the terrain and of springs, over it. Contours every 100 m from zoom 11; every 25 m at zoom 13; every one from zoom 14, with an index line every 50 m that carries its height. It has a light and a dark version, like the street map.
- The relief shading, on any base map, comes from IGN's terrain model up to zoom 13 (about 10 m a pixel), instead of the Terrain Tiles.
- The Terrain Tiles stay the elevations the app measures with: the line of sight (ADR-0032) and the climb of a way (ADR-0024) keep their worldwide data and its known error. The line-of-sight card credits it, since no map layer shows it now.
- Offline, "Topographic" downloads IGN's vector tiles to the same zoom as the street map, and "Relief" downloads both IGN's elevation tiles (shading) and the Terrain Tiles (measurements). The map database goes to version 3, which drops the scanned topographic tiles kept by version 2.

## Consequences

- The topographic map is sharp at every zoom, in the app's typeface and theme, and the names a rescuer hears on the radio ("el barranco de…", "la font de…") are on it.
- Downloading the topographic map weighs a fraction of what the scanned sheets did; the relief weighs more than before.
- The topographic map and the shading cover Spain only; elsewhere the shading is flat. The relief measurements still work everywhere.
- Two elevation datasets with two jobs: if the line of sight moves to IGN's model later, it needs its own decision on coverage and error.
- The elevation endpoint is undocumented and could change without notice; if it does, the shading goes flat and nothing else breaks.
