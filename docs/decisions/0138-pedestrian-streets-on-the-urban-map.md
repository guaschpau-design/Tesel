# 0138. Pedestrian streets stand apart on the urban map

- Status: Accepted
- Date: 2026-11-15

## Context

The base map drew pedestrian streets with every other way off the roads: on the topographic map, in its brown (ADR-0136 left them so). Pau noticed them there in a colour of their own, where they do not matter, and asked for them on the urban map (ADR-0137), where they do: a vehicle cannot go down them, and people gather in them.

## Decision

- Pedestrian streets (`kind_detail` pedestrian) get layers of their own, a line on a casing, drawn as each base map wants them (`PedestrianLook`, passed to `trailLayers`).
- **On the topographic map they are streets like the others**: white on a light casing; pedestrian squares a shade lighter than the land.
- **On the urban map they stand apart**, in a lilac grey as OpenStreetMap's own map draws them, and pedestrian squares in a paler shade of it.

## Consequences

- In a town, where a vehicle cannot go is read at a glance on the urban map; the topographic map stays quiet about it.
