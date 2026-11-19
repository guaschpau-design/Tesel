# 0144. The tactical map in coyote

- Status: Accepted
- Date: 2026-11-19

## Context

ADR-0141 made the tactical map read as a military map, on the graphite ground it had had since ADR-0114. Pau found it too dark once the night map («Nocturno») took over the night, and asked for it to look more military still. Two first proposals, a light 1:50 000 paper map and olive drab, did not convince him. Of three more, drawn from the app with real data (a blue slate grey, coyote, and the neutral greys of a command post), he chose **coyote**.

## Decision

- The tactical map's ground is coyote, the sand of military kit (`COYOTE_PALETTE`, `map/style/tactical.ts`): woods in olive with a texture of darker dots, water in a grey blue, roads dark brown on light edges, the more important the darker, streets light on brown edges, buildings dark, bridges edged in black, names black on a sand halo.
- Its look is a map look of its own, `coyote` (`data-map-theme`), with what is drawn over it dark: the MGRS grid in near black, contour lines in brown, key points (services) in a deep red, the arrows of streams in a darker blue on a light edge. Its icons are the light ones.
- The relief is shaded a little less than on the topographic map (0.35 rather than 0.45), so the sand keeps its colour on slopes.
- Everything else of ADR-0141 stays: relief always, contours, arrows the way streams flow, woods as cover, key points, names in capitals, the grid switched on with the map and its digits at the screen's edges.
- The night map keeps starting from the graphite palette (`GRAPHITE_PALETTE`) before turning it into reds: what was dark stays dark at night. The map look `dark`, which only the tactical map used, is gone.

## Consequences

- Each base map has its own place: topographic for the hills by day, urban for towns, tactical in coyote for a military reading at any hour of daylight, «Nocturno» for the night.
- Coyote is light, so it reads in full sun, and it is like no other base map of Tesel.
