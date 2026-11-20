# 0154. OpenStreetMap's buildings on every map

- Status: Superseded by [0161](0161-overture-buildings.md) (Overture Maps' buildings, which hold OpenStreetMap's and add IGN's and those found in aerial imagery)
- Date: 2026-11-20

## Context

ADR-0139 drew, in Spain, the buildings of IGN's vector map (`edificio_pol`) over OpenStreetMap's, taking them for the cadastre's. ADR-0149 then hid OpenStreetMap's where IGN's were drawn, as the two, a few metres apart, showed many buildings twice. On the tactical map, Pau found the Polígono Industrial de Roques Planes (Tarragona) almost empty where the photographs show it full of sheds: IGN's map is not the cadastre but a summary of it, and has hardly any of them, at zoom 15 as at 16. Drawing both again would bring back the doubles, and on the urban map their edges crossing inside each other.

## Decision

- **Every map draws OpenStreetMap's buildings alone**: topographic, urban and tactical, in Spain as elsewhere. On the tactical map at full strength, as cover; on the topographic map at the base map's half, as before ADR-0139; on the urban map edged and, in 3D, raised to their height.
- IGN's buildings are no longer drawn, nor raised in 3D. Its map still gives the names of the terrain, the way streams flow (ADR-0140) and, on the urban map, the official house numbers.
- The cadastre stays where it was, a layer of its own in «Capas del mapa» (its parcels, ADR-0036), over any map.
- What decided between the two sources as the view moved (`one-layer-of-buildings.ts`, ADR-0149) is removed.

This supersedes the buildings of [ADR-0139](0139-cadastre-buildings-and-addresses.md) and [ADR-0149](0149-one-layer-of-buildings-and-tidier-layers.md).

## Consequences

- One building where there is one, wherever OpenStreetMap has it; where its volunteers have not traced a street, it is missing.
- The official cadastre's buildings, complete for Spain and published by the Dirección General del Catastro and the regional cadastres, could make a layer of the app's own for the urban map later, built on the server.
