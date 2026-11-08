# 0033. Warning on entering a danger area, worked out on each device

- Status: Accepted, amended by [0122](0122-zone-crossings-and-telling-outside.md) (a member who shares their position tells the group of a danger area entered)
- Date: 2026-10-27

## Context

The group already marks danger areas (protocol §4.2, style `0x0001`): a collapse, a flooded riverbed. A member who does not look at the map at the right moment walks into one. ATAK's geofences warn on entering; Tesel should too, without a network, since that is when it is most likely to be needed.

## Decision

- Each device compares its own position with the group's danger areas (polygons and circles; lines are not areas) and warns its user on entering one: a red-edged card on the map naming the area, and a vibration. Closing it lasts until the device leaves the area; entering again warns again.
- Nothing is sent: the areas are already on every device, and the position never leaves it for this.
- While the group has a danger area, the GPS stays on for this check, whatever the user shares. Without it a warning would depend on the user having turned something else on.
- Any member may mark a danger area, as before: warning of danger is not a coordinator's privilege.

## Consequences

- Works offline and over LoRa alike: the warning needs only the areas and the GPS.
- Battery: the GPS runs while a danger area exists in the active group; deleting the area stops it.
- The position used is the GPS fix as reported; within its accuracy, a device on an area's edge may warn a few metres early or late.
