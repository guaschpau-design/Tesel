# 0075. A mountain route, played where the map is

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-30

## Context

The user asked for an exercise with a group of hikers on a high mountain route. Every other exercise is played round where the user is, but a mountain cannot be faked: a route needs paths that climb, and most users practise from a town.

## Decision

- A fifth situation, a **mountain route**, played where the map is when the practice starts: the user takes the map to the mountains first, as the setup says. A situation tells where it is played (`place`: here or the map) and whether a place suits it (`suits`). Where the land does not rise at least 150 m to the highest path within 650 m, or its heights cannot be read, the card says so and nothing starts.
- The route goes from the trailhead, where the map's middle is, along the paths of the base map to the highest point they reach (`MountainRoute`). The group climbs it in a column, a few metres apart, at the group's pace (`Column`). Whoever is sent on a task leaves the column and joins it again once free.
- The story: the forecast brings storms forward; ten minutes in, fog, and Jordi takes a path that leads nowhere (`Astray`); at fourteen, Sara slips and cannot walk (`Rescue`); at sixteen, thunder; at twenty-two, the storm is overhead. Whoever is in the upper third of the route then is in danger.
- Sara is rescued by helicopter only if a report reaches the 112 in time: it flies in five minutes, two more if nobody has marked where it can land near her, and not at all once the storm is overhead.
- With the user as a member, Carmen guides: she sends Nuria for Jordi, turns the group back at the first thunder and asks the user to send the report and mark the landing place, sending it herself after three minutes. As coordinator, the user guides: the group turns back when the user says so in the chat ("bajamos", "media vuelta", "turn back"…) or gives someone a task at the trailhead.
- The report tells when the group turned and who decided, how many were high up in the storm, how long Jordi was lost and how he came back, and when the report went and how Sara was rescued.

## Consequences

- The mountain is real, and its paths and heights are the map's; a flat place is refused rather than pretended to be a mountain.
- The heights must be read, so the route needs a connection or a downloaded area with relief.
- The group's turning back is read from plain words in the chat, as people would understand them, as well as from tasks.
