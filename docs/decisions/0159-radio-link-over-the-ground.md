# 0159. A radio link over the ground

- Status: Accepted
- Date: 2026-11-20

## Context

Tesel's mesh radios (MeshCore, on LoRa) carry the team's messages where there is no network. LoRa needs the way between two radios clear: a hill between them cuts the signal. A team placing itself, or a repeater, needs to know beforehand whether a radio there will reach. Pau chose it for the tactical map. An earlier check of the kind, «Visión radio» (ADR-0032), offered from any point of any map, had been taken out (ADR-0042); this one lives on the tactical map only, where reading the ground is the point, and takes in the Fresnel zone and the antennas' height. It supersedes ADR-0042.

## Decision

- **«Enlace de radio desde ti»**, on the tactical map, in the panel of a point, a map object or a member (under how far it is): whether a radio here reaches there over the ground (`terrain/radio-link.ts`).
- **How it is worked out**: the ground between the two is read from the elevation tiles every 30 m, raised by the earth's curve as radio sees it (the earth's radius taken a third larger, as the air bends the signal back). The signal needs more than the straight line clear: the first Fresnel zone, at 868 MHz, LoRa's band in Europe. The verdict:
  - **clear**: the ground stays below the line and 60 % of the zone;
  - **just** («roza»), in amber: the ground within the zone, at the point where it comes closest: it may arrive weak;
  - **cut**, in red: the ground above the line, told where it stands highest and how high.
- The panel draws the ground's profile with the signal's line and the zone's lower edge, and the map the link: green while the signal passes, amber where it grazes, red from where the ground cuts it, with a ring where it cuts it most.
- **The antennas' height** is chosen for both ends, and kept: in the hand (1.5 m), on a mast of 5 m or 10 m.

## Consequences

- Before moving, a team sees whether its radios will still talk, and how high an antenna would have to go.
- Only the ground counts: buildings and trees also block the signal, and the panel says so. Held in the hand over flat ground, the zone is seldom clear: «roza» there means a shorter reach, not none.
