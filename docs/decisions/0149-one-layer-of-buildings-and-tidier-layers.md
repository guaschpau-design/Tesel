# 0149. One layer of buildings, and tidier layers

- Status: Accepted
- Date: 2026-11-19

## Context

Pau saw every building twice on the tactical, urban and topographic maps: the cadastre's (ADR-0139), where it stands, and OpenStreetMap's under it, traced by hand over photographs and often a few metres off. It looked poor, and the map drew twice the buildings it needed. He also asked, after many changes to the map's layers, that their code be left clean: no patches, no dead code.

## Decision

- **In Spain, the cadastre's buildings alone.** While the view is in Spain's outline, reaches no other country's (Portugal's, France's) and shows the cadastre's buildings, OpenStreetMap's flat buildings, and the urban map's edge round them, are hidden (`map/style/one-layer-of-buildings.ts`, kept by `MapView`, decided each time the map settles). Where the cadastre cannot be had, offline in an area downloaded before it was (ADR-0139) or with IGN's service down, OpenStreetMap's stay, so that a town never shows no buildings. Elsewhere they are the only ones and stay. Raised in 3D, OpenStreetMap's stay everywhere, for their heights. Spain's outline is the one the satellite map already uses (`borders-data.ts`), loaded with the first view close enough.
- A whole view, not each tile, decides: MapLibre cannot hide one source's features where another has some, and a filter by country cannot test polygons. A view on a border shows both, as before; the coast does not count as a border.
- **Each of our layers draws a point once.** The members, this device, tasks and reports drew their dot even under their APP-6 symbol on the tactical map, made invisible so that it could still be tapped. Now each draws either its dot or its symbol, and taps are taken on either.
- **The topographic and tactical maps share the walker's ground** (woods, streams, tracks and footpaths, ADR-0136) in one function, each with its own inks, where the tactical map had a copy of it.

## Consequences

- One building where there is one; in Spain the map draws about half the polygons it did close up.
- In a town on the border, a view that takes in both countries still shows OpenStreetMap's buildings under the cadastre's on the Spanish side.
- Nothing invisible stays on the map to be tapped; a layer's look is decided in one place.
