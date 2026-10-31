# 0081. Found in a tap or two

- Status: Accepted
- Date: 2026-10-31

## Context

The same walk through the app as [ADR-0080](0080-told-without-looking.md) found what is often wanted a few taps further than it should be. "Guide me" sat at the foot of a teammate's card, under every detail and a long sentence on what had come by radio; the members list could not be tapped. A member who joined saw the map from a hundred kilometres up, even when the coordinator had drawn the operation area. The drawing card was four pictograms with no names, the two newest of them, typing coordinates and reading a file, hard to guess; a marker offered undo with nothing to undo. Notices said "Sent to the group." whatever was sent, the same one twice in a row, and none could be acted on; a chat line from someone else made no notice at all. In the tasks, whoever coordinates saw "Start" and "Done" on the tasks of others, which took them from whoever had them; the list did not say who had what; the common tasks came before the field to type one; a task along a route had to be opened on the map to follow it; and "Done" tapped by mistake could not be taken back.

## Decision

- A teammate's card begins with how far they are and "Guide me"; then what they tell about themselves; last, one line, "Last heard: by internet, 2 min ago". A member of the list opens their card with a tap, this device's own row opens Me.
- While the map still shows the wide view it opened on, the operation areas are framed with the members (start-framing.ts), so whoever joins sees where the group works.
- The small buttons of a tool's card show a name under their pictogram (`ToolButton`): "Undo", "Coordinates", "File", "Cancel". A marker has no undo.
- A notice says what was sent ("Marker: the group has it.") and is not repeated while it is shown: the same one shown again lasts longer. A notice of a task handed over, of a report or of a task started or finished has "View", which opens it. A chat line from someone else, while the chat is closed, shows who and how it starts, with "View"; one at a time.
- The tasks are listed by whom they are for: this device's first, then each member or team by name, then those for anyone. Only this device's own tasks and those for anyone have the button that moves them along; anyone may still open any task to change it. A task along a route or a strip starts with "Follow route" or "Follow strip", which starts it and guides along it. A task marked done offers "Undo" in its notice. "New task" comes after the list, and the field to type a task before the common ones.

This amends [ADR-0070](0070-a-simpler-app.md) and [ADR-0071](0071-panels-read-whole.md).

## Consequences

- Going to a teammate is two taps from the map or the members list.
- A coordinator sees at a glance who has what, and cannot take a task from someone by mistake; to change another's task they open it.
- The drawing card is a little taller: on a narrow phone, "Finish" may go under the other buttons.
