# 0147. No night map

- Status: Accepted
- Date: 2026-11-19

## Context

ADR-0141 added a fifth base map, «Nocturno», the tactical map in reds on black, so as not to spoil the eyes' adaptation to the dark; ADR-0145 and ADR-0146 gave it the tactical map's margin, ways and APP-6 symbols in reds. Having used it, Pau found it of little use and hard to read, and asked for it to go.

## Decision

- «Nocturno» is removed: four base maps again, topographic, urban, satellite and tactical. A device that had it chosen opens on the default, the topographic map.
- What only it used goes with it: the map look `night` and its colours, the graphite palette it started from and the turning of a palette into reds (`inRed`), its images of woods, streams and huts, and APP-6's red-on-black drawings. APP-6 symbols have one look, the tactical map's.
- What is said of the tactical map stays, and is now of one map only: it comes with the MGRS grid, MGRS coordinates and bearings in mils from magnetic north (ADR-0145).
- For the night the app's dark mode remains (ADR-0114): it darkens the bars and panels, and leaves the map as chosen.

## Consequences

- One base map fewer to choose from and to keep up.
- A team working at night uses the tactical or topographic map with the app in dark mode.
