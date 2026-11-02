# 0100. Weather warnings leave the map clear to work on

- Status: Accepted
- Date: 2026-11-02

## Context

Official weather warnings hatched the whole of their regions ([ADR-0038](0038-official-warnings-look.md)), and a card at the top of the map said what was in force where this device is. Warning regions are large, a district or a province, so whoever works inside one had the whole map striped, under their markers, areas and members, and once the card was closed nothing on screen said the warning was still there.

## Decision

- **An edge that stays.** A region keeps its thin edge in the colour of its level, and gains a band of that colour along the inside of it, about a finger wide, that fades towards the middle. The edges are turned so that the region lies on their right, whichever way the issuer wound them, so the band is always inside.
- **Hatching seen from afar only.** The hatching shows at zoom 9 and less, to find warnings at a glance, and fades out by zoom 11.5. Closer, the inside of a region is left clear.
- **One line in place of the card.** A warning not seen yet still opens in full where this device is. Closing it leaves one line at the top of the map instead, for as long as the device is in the region: the highest level, what it warns of and until when, and how many other warnings there are. Tapping it opens the card again.

## Consequences

- Warnings are still told apart from the group's areas, which have a flat fill and a thick edge: by the hatching from afar, by the band fading inwards and by the cloud on a rounded square close up ([ADR-0038](0038-official-warnings-look.md)).
- The line at the top takes room while it is there; the map layers panel still hides warnings altogether.
- The cloud is still drawn once in every map tile a region covers, so a region can show it several times.
