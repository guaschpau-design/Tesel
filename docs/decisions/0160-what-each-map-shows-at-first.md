# 0160. What each map shows at first

- Status: Accepted
- Date: 2026-11-20

## Context

ADR-0155 had each base map turn on what it is for, but left on what another map had turned on: the tactical map's grid, mils and MGRS stayed on the topographic map once chosen, and bearings were read in mils there too. Pau set what each map shows when it is chosen.

## Decision

Choosing a base map in «Capas del mapa» sets the map's own layers as follows (`map/map-defaults.ts`); each can be changed again after.

| Layer            | Topographic | Urban | Aerial | Tactical |
| ---------------- | ----------- | ----- | ------ | -------- |
| Services         | on          | on    | on     | on       |
| Weather warnings | off         | off   | off    | off      |
| Relief           | on          | off   | off    | on       |
| Slopes           | off         | off   | off    | on       |
| Cadastre         | off         | off   | off    | off      |
| Fires            | on          | off   | off    | off      |
| Flood zones      | off         | on    | off    | off      |
| Radar            | off         | on    | off    | on       |
| MGRS grid        | off         | off   | off    | on       |

The aerial photographs, which Pau left out, take what every map shares: the services on, the rest off.

Bearings are read in mils from magnetic north on the tactical map and in degrees from true north on the others. Coordinates are in MGRS on the tactical map; off it, in the format the user chose, or in degrees if that was MGRS.

The layers of the group (members, markers, tasks, reports, trails) are left as the user has them. The urban map still raises its buildings in 3D.

This replaces the per-map choices of [ADR-0155](0155-three-maps-three-questions.md).

## Consequences

- Each map looks the same each time it is chosen, whatever was chosen before.
- The first time the app opens, on the topographic map, nothing has been chosen yet: relief and fires stay off as before, so that a new device asks no public service for them by itself (ADR-0024, ADR-0120) until a map is chosen.
