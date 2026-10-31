# @tesel/scenario

Staged operations as data: who takes part, where each member walks, and what they do and when (chat, markers, shapes, SOS calls, their acknowledgements and cancellations, what members carry, teams, tasks and their progress, reports and sweeps). `plan()` turns a scenario into the events to send, in time order: each member's announcement, their positions along the route and the scenario's steps. A `ScenarioPerformer` then sends them one by one: it turns each planned event into a Tesel event still without its header, which the sending device fills in, and remembers what has been sent for the steps that refer to it. Members are named by alias.

Pure TypeScript, no I/O: the same scenario always gives the same plan. [`tools/simulator`](../../tools/simulator/README.md) (`src/play.ts`) sends it through the relay, one simulated device per member, for demos and screenshots, with a `ScenarioPerformer`.

| File             | Responsibility                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- |
| `scenario.ts`    | The scenario model, its plan and where a member is on their route                   |
| `event-draft.ts` | The event of each planned action, and `ScenarioPerformer`, which sends them in turn |
