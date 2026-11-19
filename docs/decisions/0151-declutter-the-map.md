# 0151. Declutter the map

- Status: Accepted
- Date: 2026-11-19

## Context

In an operation the map fills: services, tasks, reports, trails, names of streets and shops. SitaWare has declutter tools that leave the essential in one action. Pau approved one for Tesel.

## Decision

- **A button among the map's controls, «Despejar el mapa»**, under the 3D button, lit while pressed. It is a preference: the map stays decluttered until pressed again.
- Decluttered, the map draws only **the team, threats and calls for help**: the members, this device and SOS calls (always shown); of the group's markers only threats, those APP-6 draws hostile (fire, flood, hazard) and closed ways (`isThreat`); of its shapes only the danger areas; and of the base map's names only those of places (towns, districts, regions). Tasks, reports, trails, sweeps, public services and weather warnings are not drawn. What the user turned on, the grid, the radar, relief, stays.
- The layers panel says so above its switches, which it overrides, with «Mostrar todo».

## Consequences

- One tap from a busy map to the one an operation is run on, and back.
- Injured and missing people's markers are not threats and go too; they can be added if the field asks.
