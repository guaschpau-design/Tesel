# 0101. What a choice does is shown on asking

- Status: Accepted
- Date: 2026-11-02

## Context

Some switches carry a line on what they do: saving energy, the "Are you still OK?" check and inviting someone as coordinator. That line is read once and then only takes room: saving energy's ran to four lines on a phone, more than all the other settings around it.

## Decision

- A choice whose name is not enough has a small (i) beside its name, grey to the eye and as large as a fingertip to tap (`ui/InfoButton.svelte`). Tapping it shows what the choice does underneath; tapping it again hides it. Switches have it in `ui/SwitchRow.svelte`, anything else in `ui/Explained.svelte`.
- The same goes for how a part of the app works, read once: what a team is (beside "New team"), the radio's PIN and what to do when it does not appear (beside "Connect radio"), what downloaded maps are for and which areas the extra layers cover (in offline maps), and which coordinate formats can be typed.
- The radio tab of the chat says what it is for while it is empty, and no more once messages have arrived. The line on what an operation area is for stays in sight: it is short and shows only when that kind of area is chosen.
- The explanation stays until it is hidden, never on a timer: someone reading slowly, or looking away in the field, would lose it mid-sentence.
- Tapping the (i) leaves the switch as it was. Screen readers hear the explanation with the switch, shown or not.
- This is the one way the app offers a second level of information. Warnings that keep someone safe, such as who may join with an invitation, stay in plain sight.

## Consequences

- Settings, the group's switches and the panels named above take less room, whatever they explain.
- The (i) is never a form's submit button, so asking inside a form sends nothing.
- Whoever wants to know what a choice does has to look for the (i): the switches whose names say enough have none, so its presence means there is more to know.
