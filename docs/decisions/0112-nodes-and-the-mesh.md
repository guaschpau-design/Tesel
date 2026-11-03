# 0112. Say "node" and "the mesh", not "radio", to the people who use Tesel

- Status: Accepted
- Date: 2026-11-03

## Context

The app and the site called the LoRa devices "radios" and the way without coverage "by radio". To most people a radio is a walkie-talkie, something to talk through. What Tesel carries this way is data (positions, alerts, marks on the map, SOS calls), passed from device to device over a network the team's own devices make. The word set the wrong picture, and a less technical one than Tesel is.

## Decision

- The devices are **nodes** ("nodo"; "nodo de bolsillo" where the site first introduces them; "nodo LoRa" where the kind matters). The network they make is **the mesh** ("la malla", "red de malla"). Messages go **over the mesh** ("por la malla").
- The site says once what a node is: a long-range, very low-power LoRa transmitter; and that the nodes link up into a mesh of the team's own, with no masts and no operators.
- Its sign is three nodes linked to each other (`mesh` in ui/glyphs.ts), not an antenna mast: on the connections card, in the top bar and beside members reached over the mesh. The mast stays the map symbol of a command post.
- In the app: "Conectar nodo", the connections card "Malla" / "Mesh", the chat tab "Malla pública" / "Public mesh", "Te llega por la malla", "Sin nodo".
- Code, comments, the protocol and the technical documents keep the technical words (radio, LoRa, link): they are for programmers, for whom they are exact.
- "Emisora" (a radio set a member carries, in the kit list) and "radio" of a circle are other things and keep their words.

## Consequences

- One picture, the same in the app and on the site: a network of the team's own, not a walkie-talkie.
- "Nodo" is the word MeshCore and Meshtastic use, so what people read in Tesel matches what they read on their devices and in their apps.
- A screenshot or guide made before this shows the old words until it is made again.
