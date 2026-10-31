# 0071. Me and the map layers are read whole, without opening anything

- Status: Accepted, amended by [0078](0078-one-look-and-straight-to-the-point.md) (the LoRa line, casualties folded) and [0081](0081-found-in-a-tap-or-two.md) (a member's card begins with the way there)
- Date: 2026-10-29

## Context

ADR-0061 folded a member's position, battery, equipment and tasks into one line each, and ADR-0070 folded the profile in Me and six of the eleven layers under "More layers". Used on a phone, folds hid what was wanted: a layer switched on under "More layers" could not be seen until the fold was opened, and Me had to be opened section by section to be read. The line on a LoRa radio (ADR-0069) took a box of four lines, and the credits of the map's data a heading and a list.

## Decision

- A member's sheet, in Me and on any member's card, shows every part in view, each under a small title: the profile and the battery on one line each, then position, equipment and tasks. A part with one short line, as tasks when there are none, keeps it beside its title.
- The LoRa radio line is one line of small text, with "Connect radio" beside it when there is none.
- The layers panel shows every layer as a tile, three to a row, lit in the accent while the layer is shown and faded while it is not, under the three base maps. The credits and the licences are one line of small print.
- The practice's setup chooses the situation from chips and the part from two halves of one row, with one line saying what the chosen part does.

This amends [ADR-0061](0061-member-state.md), [ADR-0069](0069-who-keeps-in-touch-without-coverage.md) and [ADR-0070](0070-a-simpler-app.md).

## Consequences

- What a member tells, and which layers are on, is seen at a glance. Me is longer and scrolls on a small phone; the status stays first.
- Folds remain only where what is folded is used now and then: organising a group, the other groups, a report's optional fields.
