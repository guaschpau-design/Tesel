# 0072. Practice as an exercise: a world that changes, people with their own lives, and a director

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-30

## Context

The practice (ADR-0031, ADR-0066) was a guided tour: a few steps played in order, four teammates who took tasks and answered an SOS, and a guide that ticked off five things to try. It taught where the buttons are, not what a real call-out feels like. Nothing happened unless the user did something, the situations never changed, the teammates never tired, ran out of battery or met a street they could not cross, and a coordinator who did nothing lost nothing. The texts said "the stream" and "a house", never which, so the place the user knows did not take part.

## Decision

- A practice plays an **exercise** of about twenty-five minutes (`Exercise`): an opening (the cast and the first messages, as a scenario played with `plan`), the people in it and what they carry (`Persona`), a **world** that changes by itself (`World`: what can be crossed and what happens each second), and **injects** (`Inject`): news, calls and orders played once, at a time or when something has happened, by a `Director`. It ends when its story ends (the person found, the water going down, the fire held) or when its time is up, and says how it went.
- The run (`PracticeRun`) is the stage everything plays on (`Stage`): each second the teammates' routines (answering an SOS, tasks, talk, body), then the world, then the director. Everything it says or marks goes out through the protocol's own events, in order, fitted to their limits; one that cannot be encoded is an error, not something dropped.
- The world is the place the user is in. Round the user, the streets with their names, the streams and rivers and the parks are read from the base map's tiles (`map/tiles/surroundings.ts`, which replaces `walkways.ts`), and the heights from the elevation tiles where a flood needs them (`Ground`, `HeightGrid`). Directions are told as people tell them: "in Calle Mayor, 300 m north of the meeting point".
- Seven teammates and the 112 control room, in two teams: Carmen leads, and whoever the user is not is played. Each has a phone that runs down at its own pace and a body that tires; they say so, save battery, go silent, take a break. They walk only where they can (the water and the fire close streets: `WalkNetwork.way` takes what may be crossed), say once when they cannot reach a task, and try again later.
- Three situations: a missing person (a woman with dementia, hidden where people like her are found; a stick on the way, a witness, a false lead, a second sector), a flood (the water rising from the nearest stream over the real heights, homes to warn, people trapped, a closed underpass, a power cut) and a wildfire (a front that spreads and turns with the wind, houses to empty, a pull-back, an aircraft and a helipad to mark). If the user, as coordinator, does nothing, the world goes on: dogs, boats and fire crews arrive later, and the end says what was lost.
- Chance is seeded (`Chance`) and every line has several ways of being said (`voice.ts`), so two exercises are not the same, while a test can play one again exactly (`exercises.test.ts` plays each situation in each part to its end).
- The engine stays in the web app (`lib/practice`) while it plays on one device. It moves to `@tesel/scenario` when a team drill, played by several devices through the server, needs it.
- `@tesel/scenario`: a marker or a shape sent again under the id it was given is a new version of the same object, so a world can redraw what it marks.

This amends [ADR-0031](0031-practice-mode.md) and [ADR-0066](0066-practice-situations.md).

## Consequences

- A practice is a call-out to live through, not a tour: there is always something going on, and what the user does, or does not do, changes how it ends.
- The card shows how long the exercise has run; the guide stays, for those who want it.
- Starting takes a moment longer: the streets, names and, for a flood, heights round the user are read first. Heights that take more than a few seconds, or are not there offline, are done without: the ground is then taken to rise gently and unevenly away from the stream.
- On the synthetic map of the tests, the streets are named and there are a stream and a park, so the exercises can be tested end to end.
- Next: a report at the end, a mountain route and a sports event, losing coverage, and a drill with several real people.
