# 0165. Aid points among the services

- Status: Accepted
- Date: 2026-11-22

## Context

Pau asked for fire hydrants, drinking water and defibrillators on the map, within «Servicios». The base map's builds (Protomaps) keep drinking water but no hydrants or defibrillators; Overture Maps' base theme has hydrants and drinking water but no defibrillators. OpenStreetMap has all three.

## Decision

- **The server builds an archive of aid points every week** (`apps/server/src/maps/build-aid-points.ts`, run by `deploy/vps/aid-points.sh` and `tesel-aid-points.timer`, Mondays): OpenStreetMap's defibrillators (`emergency=defibrillator`), fire hydrants (`emergency=fire_hydrant`) and drinking water (`amenity=drinking_water`) in the base map's area, asked of the Overpass API three degrees at a time, one request after another. Of each it keeps where it is, its name, and for a defibrillator where exactly and when it can be reached (`defibrillator:location`, `opening_hours`, `access`), for a hydrant its type. Written as vector tiles of zooms 12 to 14 (`geojson-archive.ts`, with MapLibre's own tiler), published at `/maps/aid-points.pmtiles`.
- **The services layer draws them** with the others (`services/`), under them, each kind from its own zoom: defibrillators from 13, with their name (green, a heart struck by a bolt); drinking water and hydrants, by the thousand in a city, from 16, smaller and nameless (blue drop, red hydrant).
- **A tap opens the point's panel** with what is known: where exactly, hours (24/7 read as «a todas horas»), access, hydrant type.
- **Offline**: downloaded with each area, as the buildings.
- The app finds the server's own archives in one folder, `VITE_MAPS_URL` (`/maps/` on the server), replacing `VITE_BUILDINGS_URL`.

## Consequences

- A defibrillator or a hydrant missing from OpenStreetMap is missing here: the map shows what volunteers and councils have mapped, and cannot tell a place without one from a place not mapped.
- A week at most between a point mapped and a point shown.
