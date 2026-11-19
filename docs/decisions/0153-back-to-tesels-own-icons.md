# 0153. Back to Tesel's own icons on the tactical map

- Status: Accepted
- Date: 2026-11-19

## Context

ADR-0146 and ADR-0148 drew everything on the tactical map in NATO's symbology, APP-6: markers, members, public services, tasks, reports and this device. Using it, Pau found it confusing. In APP-6 a frame says which side something is on, not what it is, so a member and a post of the team share the same blue rectangle: a member of a medical profile and a first-aid post differed only by a small bar on top. The form that makes a marker kept Tesel's own icons, so what was chosen was not what was drawn. Pau decided to keep the tactical map's functions and go back to Tesel's icons, on the map and in every menu.

## Decision

- **Every map draws Tesel's own icons**: markers in their coloured tiles, members, this device, tasks and reports as their dots, public services as round icons. The form that makes a marker shows what the map draws, on every map.
- **The tactical map keeps what makes it tactical**: coyote and relief, contour lines and the way streams flow, tracks and footpaths, the MGRS grid and its margin, mils from magnetic north, the radar with it (ADR-0141, ADR-0144, ADR-0145, ADR-0150), no shops or museums of the base map, «Despejar el mapa» and «Qué se ve desde aquí» (ADR-0151, ADR-0152).
- **The movement line stays** (ADR-0150), out of each member's dot and this device's (`map/movement.ts`), drawn on the tactical map only.
- On a decluttered map, threats are markers of fire, flood, hazard and a closed way, by their symbol (`isThreat` in `objects/catalog.ts`), no longer by APP-6's frames.
- APP-6's code is removed (`objects/app6.ts`, `objects/app6-images.ts`), with what each layer did to choose between a dot and a symbol.

This supersedes [ADR-0146](0146-nato-symbols-on-the-tactical-maps.md) and the symbols of [ADR-0148](0148-everything-in-nato-symbols-and-which-way-people-move.md), whose compass and directions stay as ADR-0150 left them.

## Consequences

- One set of icons for the whole app: what a marker is called and looks like in its form is what it is on every map.
- A team used to military maps does not find its symbology. If it is wanted again, APP-6D's own frames for people on foot, which tell a person from a post, would be the place to start.
