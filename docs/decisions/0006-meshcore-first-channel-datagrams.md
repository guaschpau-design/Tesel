# 0006. MeshCore first, through channel data datagrams

- Status: Accepted, amended by [0098](0098-meshtastic-radios.md) (Meshtastic radios as a second kind), [0099](0099-sealed-radio-frames.md) (sealed frames on `data_type` 0xFF4E)
- Date: 2026-10-25

## Context

Only one LoRa stack fits in the first week. MeshCore companion firmware (v1.18, October 2026) offers `CMD_SEND_CHANNEL_DATA`: binary datagrams of up to 165 bytes, flooded to a group channel and encrypted by the radio with the channel secret, tagged with a 16-bit `data_type` that identifies the application. The MIT-licensed `@liamcottle/meshcore.js` library implements the companion protocol over Web Bluetooth and Web Serial, including this command.

## Decision

- Support MeshCore first; Meshtastic follows after v0.1.
- Each event is sent as one channel data datagram on the channel configured with the group secret.
- Use `data_type` `0xFF4D` from MeshCore's development range until the project is demonstrable, then register a permanent value in MeshCore's `number_allocations.md`.
- Wrap `meshcore.js` behind `packages/meshcore` so the rest of the code does not depend on it.

## Consequences

- Tesel traffic coexists with ordinary MeshCore chat on the same radios.
- Datagrams carry no delivery acknowledgement; reliability for critical events (SOS) is handled in `packages/core` with application-level `ACK` events and retries.
- Requires companion firmware with channel data support; older firmware is detected and the user is told to update.
- Swapping or forking the library later only touches `packages/meshcore`.
