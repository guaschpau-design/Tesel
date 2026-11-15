# 0137. The urban map

- Status: Accepted
- Date: 2026-11-15

## Context

The topographic map is made for the hills (ADR-0034, ADR-0136) and the tactical map for the night (ADR-0114). In a town, what a team asks the map is which street and which door a person is at, and how to get there: street names it can read at a glance, house numbers, which way a street runs, which buildings are tall, and where the hospital, the police and the fire station are. Contour lines, relief shading and woods only get in the way there. Pau asked for a fourth base map for operations in towns.

## Decision

- **A base map "Urbano"**, beside "Topográfico", "Satélite" and "Táctico", drawn from the same Protomaps base map (`map/style/urban.ts`), so it works offline in every downloaded area with nothing more to download.
- **Light and neutral**: grey land, buildings darker than it with an edge from zoom 15, white streets on a casing; what the team marks keeps all the colour.
- **Street names larger and darker** from zoom 14; **house numbers** from zoom 17, where OpenStreetMap has them; **one-way arrows** larger.
- **Buildings raised to their height** with the ground in 3D (the "3D" button), three floors where the map does not know it.
- **Public services larger** over it (`ServicesLayer`), and footpaths and steps as on the topographic map (ADR-0136).
- **No contour lines and no relief shading**, even with the relief layer on or the ground in 3D.

Not drawn, because the base map does not carry them: fire hydrants, defibrillators and the entrances of buildings.

## Consequences

- A team in a town reads streets, numbers and blocks, and sees the tall buildings in 3D.
- Four base maps to choose from in the layers panel; the topographic map stays the default.
