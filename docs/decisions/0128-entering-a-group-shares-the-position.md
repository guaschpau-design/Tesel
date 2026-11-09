# 0128. Entering a group shares the position

- Status: Accepted
- Date: 2026-11-09
- Amends: [ADR-0110](0110-deception-and-loose-ends.md) (a first launch through an invitation)

## Context

Someone new scans the QR code, writes their name and taps the button that enters the group. The welcome already says that the group sees everyone's position. Yet they then met a card on the map, «No compartes tu posición · Compartir / Ahora no», and only a second tap shared it. Whoever created the group met the same card. Many tap «Ahora no», or do not see it, and the coordinator has members in the group who are not on the map: the one thing the group came for.

ADR-0110 kept a first launch through an invitation from sharing anything until the user chose to. Its reason, a look-alike invitation that moves a position already shared to someone else's group, does not hold there: a device on its first launch is in no other group and shares nothing yet.

## Decision

- **Entering a group by the invitation the app first opened with shares the position there**, in the same tap as entering. The welcome says so beside who sees what: «En el grupo compartirás tu posición; puedes pausarla desde Yo.»
- **Creating a group shares the position there too**, and the form says it the same way.
- The browser asks for the location at that tap, as it would at «Compartir».
- **Joining a group from a device already in another one is unchanged** (ADR-0110): the dialog asks, with a box left unticked, whether to go on sharing in it. That is where a look-alike invitation can take a position that is already shared.
- Pausing or hiding the position from «Yo» works as before, and the card on the map still appears whenever the device does not share, or the browser refuses the location.

## Consequences

- Joining is scanning, a name and one tap, and the member is on the map.
- A device that had hidden its position and creates a group shares it in the new group, as the form says.
- Someone who refuses the browser's location prompt sees the card that says the location is refused, as anyone sharing does.
