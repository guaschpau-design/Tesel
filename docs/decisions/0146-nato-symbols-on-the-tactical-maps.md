# 0146. NATO symbols on the tactical maps

- Status: Accepted, amended by [0147](0147-no-night-map.md) (no night map, nor its red symbols)
- Date: 2026-11-19

## Context

To read the tactical maps as soldiers do (ADR-0145), Pau asked for NATO's symbology, APP-6. It changes how every marker and member looks, so a sketch came first: markers and members of each kind, the four frames, and a scene on the coyote map. Pau approved it.

## Decision

On «Táctico» and «Nocturno», and only there, markers and the other members are drawn in APP-6 (`objects/app6.ts`, `objects/app6-images.ts`):

- **Frames** say what a thing is to the team: its own, a light blue rectangle; a threat, a salmon diamond; unknown, a yellow quatrefoil; neutral, a green square. A black bar on top marks an installation; a staff below, a headquarters.
- **Markers**: the command post, own with a staff and "PC" ("CP" in English); the first-aid post, own installation with a red cross; the shelter, own installation with a house; the water point, own installation with a W; an injured person, own with a red cross; a missing person, unknown with a person; fire, flood and hazard, threats with a flame, waves and "!"; the meeting point, a rally point, "PR" ("RP"); the landing site, a landing zone, "LZ"; a closed way, a block with a red cross; any other marker, a neutral square.
- **Members**, own, with their profile inside: police "LE", civil protection a triangle, firefighters a flame, medical a red cross, rescue "SAR", military the infantry's crossed lines, the rest an empty frame. Whoever coordinates the group carries a headquarters' staff. Someone resting is drawn fainter, someone not heard from in a while fainter still; their name stands further from the symbol than from a dot.
- **By night** the same symbols are red on black, as the whole night map is (ADR-0141).
- Only the drawing changes: what is marked and sent is the same (protocol §4), so members on other maps see the app's own icons for the same markers. This device and calls for help keep their own look.

## Consequences

- A team used to military symbology reads the tactical map at a glance, and anyone else learns a handful of frames.
- Each symbol and profile has its drawing in one table; a new marker symbol needs one there too, or shows as a neutral square.
