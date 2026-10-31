# 0083. Help on one page, in place of the practice

- Status: Accepted
- Date: 2026-10-31

## Context

The practice ([ADR-0031](0031-practice-mode.md), [ADR-0066](0066-practice-situations.md), [ADR-0072](0072-practice-as-an-exercise.md) to [ADR-0076](0076-practice-coverage-loss.md)) had grown into five exercises of twenty-five minutes, with a simulated control room, seven teammates who walk the real streets, a world that changes, a report at the end and a loss of coverage. It was about 9,000 lines in the app and 430 texts in each language, the largest part of it by far, and it still did not answer the first question of someone opening the app: what is this button, and how do I do the one thing I need now. A tutorial played inside the app was weighed and set aside for the same reason: another long thing to sit through, close to what was there.

## Decision

- The practice is removed: `lib/practice`, its texts, its start from the «Para empezar» card and from the groups panel, and what the group feed, the session and the map kept for it. A group of a practice still on a device when it updates is forgotten on opening (`forgetPracticeGroups`), and the group used before it is made active again.
- The help is **one page** of the site, beside the guide (`ayuda/`, `en/help/`): the app's screen drawn plainly with nine numbers (`img/help-screen.svg`, with no words, so both languages share it) and one sentence for each; eight "How do I…?" cards that give the taps as chips like the app's buttons («Pedir ayuda: SOS → qué pasa → Enviar SOS»); a note on working without coverage; and a link to the guide for the rest. It prints on one A4 sheet, to carry or pin up.
- The app opens it in a new tab from «Más» → «Ayuda» and from the «Para empezar» card, whose third way, «Cómo funciona», takes the place of «Practicar sin nadie». Every page of the site links it from its top bar; on a narrow phone the guide's link gives way.
- `@tesel/scenario` stays for the simulator, without what only the practice used: the walkways along the map's streets, `YOU` and plans without positions.

This supersedes [ADR-0031](0031-practice-mode.md), [ADR-0066](0066-practice-situations.md), [ADR-0072](0072-practice-as-an-exercise.md), [ADR-0073](0073-exercise-report.md), [ADR-0074](0074-race-exercise.md), [ADR-0075](0075-mountain-exercise.md) and [ADR-0076](0076-practice-coverage-loss.md), and amends [ADR-0070](0070-a-simpler-app.md) (the third way to start).

## Consequences

- The app is smaller and simpler to change; the help is read in a minute and needs no group, no connection once loaded, and no time set aside.
- Nobody can rehearse alone any more: a drill is done with the team, as the guide says (a message, a test SOS, the radios in airplane mode).
- The drawing is not a screenshot: when the screen changes (a button moves, the dock gains one), `help-screen.svg` and both pages must change with it.
