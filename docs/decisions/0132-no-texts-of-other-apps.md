# 0132. No text messages of other MeshCore or Meshtastic apps

- Status: Accepted
- Date: 2026-11-14

## Context

While connected, Tesel reads every message the radio holds, and taking a message off a MeshCore companion's queue takes it for good. So that text messages of other apps were not lost, Tesel kept them and showed them, read-only, in a chat tab of their own, "Malla pública" (ADR-0098, ADR-0112). People who use Tesel did not understand what that tab was: messages of strangers, in a chat beside their group's, that could not be answered.

## Decision

- **Tesel shows no text messages of other apps.** The chat has the group's messages and its reports only.
- **They are still read off the radio, and dropped**: a MeshCore companion's queue must be emptied to reach Tesel's frames. Meshtastic's are dropped as they arrive.
- **The device forgets those it kept**: the app's database, version 9, drops their store.
- The radio contract (`RadioLink`) loses `onText` and `RadioText`.

## Consequences

- The chat is the group's alone.
- Text messages of other apps that reach the radio while Tesel holds it are lost. To chat in MeshCore or Meshtastic, the radio is disconnected in Tesel and used from that app (docs/hardware.md).
