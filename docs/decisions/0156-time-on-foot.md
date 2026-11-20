# 0156. Time on foot

- Status: Accepted
- Date: 2026-11-20

## Context

Someone crossing the country on foot asks first how long the way takes: a kilometre on the flat and a kilometre up a slope are not the same. Tesel already told the distance to a point and, from the elevation tiles, how much the way climbs and descends (ADR-0115, ADR-0135), but not the time. Pau chose it for the topographic map.

## Decision

- **How it is reckoned** (`terrain/walking.ts`): the way signposted footpaths in Spain reckon it. The time to walk the length on the flat and the time to climb and descend it are worked out apart; the way takes the longer of the two and half the shorter. At a team's pace with packs: 4 km/h on the flat, 400 m/h up, 600 m/h down. Told to the nearest 5 minutes («unas 2 h 05», «unos 40 min»).
- **Where**: wherever the climb is known, so with the relief on (which the topographic map turns on, ADR-0155) or the elevation fold opened:
  - in a point's panel, under «Desnivel», with the time of arrival («A pie: unas 2 h 05 · llegas a las 17:30»);
  - while measuring, after the climb;
  - in a route's panel, after its length.
- The straight way to a point is the one reckoned, as its distance and climb already are.

## Consequences

- A team sees at a glance whether a point is half an hour or half a day away.
- It is a reckoning, not a promise: tracks, scrub, loads and the team's form change it. Straight to a point, it is shorter than any real path there.
- The pace is fixed in the code; it could become a setting if teams find it off.
