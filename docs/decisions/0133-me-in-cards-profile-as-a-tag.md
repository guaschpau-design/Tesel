# 0133. Me in cards, the profile as a tag

- Status: Accepted
- Date: 2026-11-15

## Context

Me was a column of parts split by grey lines, with the profile and the equipment folded together under "Perfil y equipo". The profile was a choice among the equipment, far from the name it qualifies, and the equipment a list of 25 pills to go through each time. Pau found it hard to read and asked for the profile beside the name, as a tag, and for the equipment to be easier.

## Decision

- **The profile is a tag beside the name** (`ProfileTag`), in Me and on anyone else's card (`MemberHeading`). In Me a tap opens the phone's own list of profiles, which closes on a pick; until one is chosen the tag says "Elegir perfil". On someone else's card it only names it, and is not there if they said none.
- **Every part of the sheet is a card** (`SheetPart`): the same faint ground, margin and small title, in place of the lines between parts. From the top: the team and the status, the tasks (one line when there are none), the position, the equipment, and the battery and the LoRa radio in two small cards side by side.
- **In Me the equipment shows only what is carried**, each a pill with a cross that drops it, and "Añadir" (`CarriedEquipment`). It opens a dialog (`EquipmentPicker`) that offers first what the profile usually carries (`TYPICAL_EQUIPMENT`, five items at most), then the rest in its four groups, each item once; a tap marks or unmarks it at once, "Listo" closes.
- The part keeps its name "Equipamiento": "Equipo" is the team a member is in.

## Consequences

- The name and what the member is read together; the sheet reads as blocks.
- The usual equipment of a profile is marked in a tap or two.
- What a profile usually carries is the app's guess, in `member-catalog.ts`, to adjust as teams say.
