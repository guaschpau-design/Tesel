# 0155. Three maps, three questions

- Status: Accepted; its per-map defaults superseded by [0160](0160-what-each-map-shows-at-first.md)
- Date: 2026-11-20

## Context

Asked what tells the topographic, urban and tactical maps apart, the answer was mostly their colours: each drew roughly the same things. Pau agreed to make each answer a question of its own:

- **Topographic**: "which way do I go on foot, across the country?"
- **Urban**: "how do I reach this door?"
- **Tactical**: "what covers me, what sees me and which way can I move?"

## Decision

**In «Capas del mapa»**, under the base maps, one line says what the chosen one is for, and choosing a map turns on what it is chosen for:

- the topographic map, the relief;
- the urban map, the buildings raised in 3D (the 3D button and choosing the urban map share `setGround`);
- the tactical map, as before (ADR-0150), the MGRS grid, coordinates, mils, magnetic north and the radar, and now the slopes.

**The topographic map** reads as a paper map: its woods greener; no house numbers; the names of small streets smaller, greyer and only from zoom 16. The heights of the mountains and passes IGN names are marked from zoom 13 (`terrain/summits.ts`, `SummitLayer.svelte`): IGN gives its spot heights only at zoom 17, past the zoom its map is read to, so they are read from the elevation tiles, a pass's where it is named and a mountain's at the highest ground within 120 m of its name, under a small triangle; a pass's beside a dot. The ones whose elevation is not known are left out and tried again later.

**The urban map** adds the town's critical places to the public services: schools and universities, close up only (zoom 16), as a town has many. Residences, car parks and hydrants are not in the base map's data.

**The tactical map**:

- _Slopes_ («Pendientes», a layer of its own any map can show): worked out on the device from the elevation tiles, as the contour lines are, and served through a protocol of their own (`map/style/slope.ts`, sharing the elevation reader in `dem.ts`). Ground a vehicle crosses is left clear; from 30 % amber, hard going for one on wheels; from 60 % red, which none climbs: the slow-go and no-go of a terrain analysis. From zoom 11.
- _Cover_: woods inked stronger, buildings solid.
- _Obstacles_: railways a solid, wider line instead of the base map's dashes.
- _Fewer civil names_: small streets' names only from zoom 16, smaller.

## Consequences

- Each map shows what its question needs, and the line under the maps says which question that is.
- The slopes and the heights of summits come from the elevation tiles (Mapterhorn), about 10 m a pixel: a cliff narrower than that, or a summit's exact height, is beyond them. Offline, they work where the relief was downloaded.
- The heights of summits are marked only where IGN names a mountain or a pass: in Spain.
- Power lines, residences, car parks and hydrants stay off the maps: the base map does not have them.
