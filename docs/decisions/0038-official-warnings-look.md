# 0038. Draw official warnings unlike the group's own areas

- Status: Accepted, amended by [0100](0100-warnings-leave-the-map-clear.md) (hatching from afar only, a band inside the edge)
- Date: 2026-10-27

## Context

The regions under a weather warning were drawn as a tinted fill with a coloured edge, as the areas the group draws are. Someone glancing at the map could take a warning region for an area the coordinator drew, or the other way round, and act on it.

## Decision

- Official warnings are hatched in the colour of their level, with a thin edge and a cloud on a rounded square in the middle.
- The group's areas keep their flat fill and thick edge, and dashes stay for what is being drawn.
- Map icons have one shape per origin: hexagons for the group's markers, circles for places of the base map, and rounded squares for official warnings (`map/glyph-images.ts`).

## Consequences

- What comes from outside and what the group decided are told apart at a glance, by pattern and by the shape of the icon.
- New kinds of official information (fire risk, road closures) take the hatching and the rounded square too.
