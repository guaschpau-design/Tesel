# 0158. What a building is

- Status: Accepted
- Date: 2026-11-20

## Context

A team called to an address in a town wants to know what it will find: how high the building is, how many floors, how much ground it covers, which doors are its own. Pau chose a building's card for the urban map.

## Decision

- **A tap on a building on the urban map** opens the panel of its point, titled «Edificio», with the building outlined in the app's colour (`buildings/`). With a panel already open, the tap closes it, as a tap on empty ground does: in a town, buildings are most of the map.
- **What it tells**, from what the map has (`buildings/building.ts`):
  - its height and about how many floors, from OpenStreetMap's height, as the base map reckons it (3 m a floor and 2 m for the roof); where OpenStreetMap does not know the height, it says so;
  - the ground it covers, when the map has the building in one piece: the map cuts buildings at the edges of its tiles, and the pieces cannot be added up exactly;
  - its house numbers: OpenStreetMap's on the building and, in Spain, IGN's official ones standing in it or within 8 m of its outline (ADR-0139).
- The rest of the point's panel stays: how far, the way there, a marker or a task.

## Consequences

- Offline, as the base map. In Valencia, about half the buildings have a height.
- The Catastro knows each building's use, dwellings and year of construction. Whether the app can ask its service directly could not be checked yet, so it is not used; it could be added later, through the app's server if need be.
