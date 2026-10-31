# 0074. A popular race to keep safe

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-30

## Context

The three exercises (ADR-0072) are emergencies that come to the team. Much of what volunteer teams do is planned: keeping a race, a march or a festival safe, with posts to hold for hours and incidents that come without warning. The user asked for an exercise of that kind.

## Decision

- A fourth situation, a **popular race** of about five kilometres round the streets of the place. Its course is a loop of the real streets, run as many times as makes about five kilometres, from a start and finish beside the meeting point (`RaceCourse`). Where it crosses other streets, the four crossings to close are named by the two streets that meet there (`Ground.crossingAt`).
- The race's own control speaks for it, at the control room, instead of the 112 room (`cast` takes the room's name). It draws the course and marks its start and finish, the medical post, the aid station and the crossings; the race starts six minutes in, and its leaders and its sweeper bike are moved on the map each minute.
- The runners are a field strung out from the leaders to the last, by their paces: whether any are passing a crossing follows. Cars try to cross now and then: one that finds someone there is stopped; one that does not gets in among the runners, until the local police take over a crossing left twice.
- A teammate at a crossing **stands guard** there (`Teammate.post`), free to be sent elsewhere and asking for nothing; whoever leaves it leaves it open. The user guards one by being on a task there.
- A runner's heart stops mid-race (`Collapse`): whoever is near runs over and starts CPR, with the defibrillator if they carry one; otherwise it must be sent. CPR within three minutes and a shock within six bring the runner back. A van stops on the course, and the aid station runs out of water (`Mishaps`).
- With the user as a member, Carmen sends one to each crossing (the user to the second, asked to tell when the leaders pass), the nurses to the medical post and Luis, with the second defibrillator, to the aid station. As coordinator, the user must do it all before the start.
- The report (ADR-0073) tells the crossings guarded when the leaders came, the cars, the times to CPR and to the shock, the van and the water.

## Consequences

- The practice now has an exercise that is planned rather than sudden, and played where the user is: its streets are theirs.
- Every incident is a choice between two goods: whoever goes to the runner, the van or the water leaves a crossing open.
- A mountain route, the other exercise asked for, needs a mountain, and comes separately.
