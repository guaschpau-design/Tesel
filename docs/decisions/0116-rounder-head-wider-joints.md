# 0116. The logo's pin: a rounder head and wider joints

- Status: Accepted
- Date: 2026-11-04

## Context

The mark of [ADR-0095](0095-pin-of-four-tiles-logo.md), a square on its corner cut into four tiles, still read more as a rounded square than as a map pin, and its thin joints made the four tiles one block. On 4 November 2026 the project owner looked at variations of the same idea and chose one: the head rounded almost into a circle, and the tiles set clearly apart.

## Decision

- The joints between the tiles are 9 units wide in the mark's 90-unit box, instead of 5: the tiles read as tiles of a mosaic.
- The head's three corners are rounded with a radius of 29 instead of 22. That rounding is wider than a tile (27.3), so it is no longer drawn tile by tile: the whole square is rounded, as the pin's outline, and the tiles are cut out of it, as the stones of a mosaic are cut to its edge. In the SVG the outline is a clip path; the tiles keep a rounding of 2.5 along the joints, and the point 1.5.
- Everything else of ADR-0095 stands: the lime point, the wordmark in Outfit SemiBold, the lockups' proportions and clear space. The colours are those of [ADR-0113](0113-graphite-and-device-lime.md).

## Consequences

- The mark reads as a pin at a glance and as four tiles on a second look; at 16 pixels the joints close into a pin with a lime point, as before.
- The mark's SVG now has a `clipPath` (`tesel-pin`). Where it is inlined more than once in one page the copies are identical, so the shared id does no harm.
