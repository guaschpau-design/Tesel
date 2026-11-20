# 0161. Overture Maps' buildings, from our own server

- Status: Accepted
- Date: 2026-11-20

## Context

With OpenStreetMap's buildings alone (ADR-0154), many are missing where its volunteers have not traced them: in the Polígono Industrial de Roques Planes (Tarragona) most of the sheds. The cadastre has them all, with their use, floors and year, but its service (WFS) answers one small area at a time, about a minute for 300 × 300 m in a town: too slow to draw a view, and asking it on each tap needs the network, which a team on radio alone does not have. Pau chose the buildings of Overture Maps, built once on the server and downloaded with the map.

Overture merges OpenStreetMap's buildings with those of national mapping agencies (in Spain, IGN's, from the cadastre) and those found by machine learning in aerial imagery (Microsoft's, Google's), keeping one outline per building, and publishes them every month as one PMTiles archive of the world (about 180 GB, zoom 0 to 14), open (ODbL) and readable by ranges. In one tile of Roques Planes: 733 buildings from OpenStreetMap, 371 from IGN and 31 from imagery. Each keeps its height in metres, its floors and its class (OpenStreetMap's `building` value) where known.

## Decision

- **The server builds a light archive of Overture's buildings** every month, after the base map: `deploy/vps/buildings.sh`, run by `tesel-buildings.timer` (the 2nd, 05:00, within a day) and once by the installer when the server has none, runs `apps/server/src/maps/build-buildings.ts` in the server's own image, without privileges and with 1 GB of memory. For the base map's area (`TESEL_MAP_BBOX`, Spain, Portugal and the islands by default) it reads zooms 13 and 14 of Overture's latest release (from its STAC catalogue), keeps of each building its outline, `height`, `num_floors`, `class` and `@geometry_source`, and nothing else (about a tenth of the size), and writes a PMTiles archive of its own (`pmtiles-writer.ts`), published at `/maps/buildings.pmtiles` with the licence's notice in `/maps/buildings.txt`. As with the base map, the new archive replaces the old only once complete and not much smaller.
- **The three vector maps draw these buildings instead of OpenStreetMap's** (`map/style/buildings.ts`): in the base map's layer, colours and order, so a building is drawn once, whichever source has it; on the urban map edged and, in 3D, raised to its height, or 3 m a floor, or 9 m.
- **Offline**: an area downloaded holds its buildings too, as the other tiles of the map (zooms 13 and 14, drawn closer up from 14).
- **A building's card** (ADR-0158) reads them: its height and floors, known or reckoned from its height (3 m a floor); its use, in a few kinds (homes, industry, commerce, education, health, worship, garages, farm, public); the ground it covers; its house numbers; and where its outline comes from: «OpenStreetMap», «Instituto Geográfico Nacional» or «detectado en fotos aéreas, aproximado».
- The app built for development reads Overture's own archive of the release it was written for; the end-to-end tests, a stand-in with no buildings.

This supersedes the buildings of [ADR-0154](0154-openstreetmap-buildings-on-every-map.md).

## Consequences

- Far more buildings, in Spain nearly all: where OpenStreetMap has none, IGN's or those seen from the air.
- The first build of the default area takes about an hour and a few GB; until it ends, a new server's maps show no buildings.
- Outlines found in imagery are rough, and many buildings have no height or use: the card says what is known.
- The cadastre's use, dwellings and year of construction are still not shown; the cadastre stays a layer of its own (ADR-0036).
