# 0163. 3D within a phone's memory

- Status: Accepted
- Date: 2026-11-20

## Context

On Pau's iPhone, Chrome (WebKit underneath) closed the page with its own error screen soon after the map went 3D, on the urban map, which opens in 3D (ADR-0155), and maybe on the others. iOS closes a page that takes more memory than it allows, and the map's drawing memory grows several times in 3D. Measured in Chromium with a phone's screen (390 × 760 points at two pixels a point), the drawing process took about 150–200 MB flat and, in 3D: the urban map 810 MB, the tactical 740–940 MB, the topographic 520–590 MB. The same before Overture's buildings (ADR-0161).

MapLibre drapes the flat layers (backgrounds, fills, lines, rasters, relief) over the raised ground as pictures, one per tile, at twice the tile's size; each run of them between other layers (names, dots, symbols, raised buildings) takes pictures of its own. Our overlays and the base maps mix them: the tactical map made five such runs, the topographic two.

## Decision

- **With the ground raised, the draped layers are kept together under all the others** (`keepDrapedTogether`, `map/ground.svelte.ts`), each group in its own order, so the ground takes one picture per tile. Done again after every style change, just after the frame, as overlays are put back (`overlay.svelte.ts`). The flat map is a style of its own and keeps its order. In 3D, names, dots and symbols are all drawn over every line, which is how they read anyway.
- **The urban map in 3D raises its buildings and leaves the ground flat**: no elevation, no sky. A town's streets read as well without raised ground, and it was the heaviest.
- The view still leans back 75°: leaning 60° saved less than these two (about 15 %), and showed the ground less.

## Consequences

- Measured the same way, in 3D: the urban map 167 MB (from 810), the tactical about 380 MB (from 740–940), the topographic about 380 MB (from 520–590).
- A town on a hillside shows its buildings raised on a flat ground on the urban map; the topographic and tactical maps raise both.
- How much memory an iPhone allows a page is not published; if 3D still closes the page on some phones, the next steps are leaning back less and drawing at one pixel a point in 3D.
