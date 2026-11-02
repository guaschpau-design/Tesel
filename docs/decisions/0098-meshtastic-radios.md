# 0098. Meshtastic radios, in code of our own, on one radio contract

- Status: Accepted, amended by [0099](0099-sealed-radio-frames.md) (radio frames sealed by Tesel, so Meshtastic events are authenticated)
- Date: 2026-11-02

## Context

ADR-0006 put MeshCore first and Meshtastic after. Meshtastic is the LoRa mesh most people already carry: a group whose members own Meshtastic radios should not have to reflash them to use Tesel, and people who carry one without Tesel are worth seeing on the map.

Meshtastic's client libraries (`@meshtastic/core`, `@meshtastic/protobufs`, `@meshtastic/transport-*`) are GPL-3.0. Tesel is EUPL-1.2, and the EUPL's compatibility clause lets EUPL code be distributed under the GPL, not GPL code under the EUPL: using, copying or adapting those libraries would turn Tesel's app into a GPL work. What a client must do to talk to a radio — the Bluetooth service and characteristics, the protobuf field numbers, the order of the configuration handshake — is an interface, documented in Meshtastic's public protocol definitions and client documentation; facts needed to interoperate are not protected expression.

A Meshtastic radio has eight channels: a primary one, which its users talk on, and seven secondaries. Each has a name and a key; the radio encrypts packets with AES in CTR mode and the channel key, and adds no authentication. Applications choose their port; `PRIVATE_APP` (256) is the one left to private applications.

The contract between the app and a radio, `RadioLink`, lived in `packages/meshcore`, and the MeshCore link asked the user to pick a radio itself, with a Bluetooth filter for MeshCore's service only. The airtime budget (ADR-0015) estimated every event as a MeshCore datagram on MeshCore's EU narrow preset, inside `packages/core`; a Meshtastic packet is framed differently, and LongFast, Meshtastic's default, keeps the air busy longer than that preset.

## Decision

One radio contract for every kind of radio:

- **`packages/radio` (`@tesel/radio`) holds what every kind shares**: the `RadioLink` contract with its errors, the Web Bluetooth types, picking a radio, pairing by reading a protected characteristic, time limits, LoRa time on air, channel names cut to what a radio stores, and the connection keeper, which runs commands one at a time with a timeout, drops a radio that misses one, and connects again with growing pauses until the user disconnects. MeshCore and Meshtastic links are built on it; neither depends on the other.
- **One picker for every kind**: the app asks the browser for a radio offering MeshCore's or Meshtastic's service, connects to see which one it offers (the browser does not say which filter matched), and only then loads that kind's package (`apps/web/src/lib/radio/radio-families.ts`). A link is made for each radio picked: `RadioLink.connect` connects to that radio, and no longer asks the user to pick. The rest of the contract keeps its meaning: straight back to `connecting` when the link drops, disconnecting allowed while it reconnects, never overwriting another channel.
- **Each kind's package has a light entry with its Bluetooth service**, `@tesel/meshcore/service` and `@tesel/meshtastic/service`, which the app loads at start for the picker. `@tesel/meshcore/link` is gone: the contract is `@tesel/radio`, which is light itself. This amends ADR-0053.
- **The link estimates airtime**: `RadioLink.airtimeMs` says how long an event keeps the air busy with that radio, and the scheduler asks the linked radio each time it weighs a packet. MeshCore's estimate is the one ADR-0015 described, moved from `packages/core` to `packages/meshcore`; Meshtastic's follows the LoRa settings the radio reports when it connects, LongFast until then, and a preset it does not know counts as the slowest one. `packages/core` keeps the budget and knows no radio. This amends ADR-0015.
- **The link says its kind** (`RadioLink.family`), so the radio card can name it and send the user to the right app when channels are full or the radio does not answer.

Meshtastic radios, in code of our own:

- **A package of our own**, `packages/meshtastic`, implements the contract for Meshtastic radios over Web Bluetooth. It depends on no Meshtastic code. It carries a minimal protobuf wire codec written from the public encoding rules (varints, 32-bit and length-delimited fields) and only the messages Tesel exchanges: `ToRadio` (a packet, `want_config_id`), `FromRadio` (packets, node info, channels, LoRa settings, the end of the configuration, queue status), `MeshPacket`, `Data`, `Channel`, `User`, `Position` and `AdminMessage.set_channel`. Field numbers and Bluetooth UUIDs were read from the public definitions; the code was written for Tesel. Tests check the codec against byte vectors worked out by hand from the encoding rules.
- **The group is a secondary channel** named after the group (11 bytes at most) whose key is the 16-byte group secret, set with an admin message to the radio itself. As for MeshCore: a channel that already holds the secret is reused, no other channel is ever changed, the primary is never touched, and a radio whose eight channels are taken says so. Leaving a group disables its channel.
- **Events travel on `PRIVATE_APP`**, as packets to everyone on the group's channel, with the radio's hop limit. Packets on any secondary channel with a 16-byte key are passed on with that key, so other groups' events are kept as for MeshCore. Text messages of Meshtastic chat are kept and shown, read-only, beside MeshCore's.
- **A packet is sent when the radio takes it**: the radio reports every packet a client hands it with a queue status carrying the packet's id, and a refusal (a full queue, its own duty-cycle limit) fails the send, which the scheduler retries.
- **Pairing works as for MeshCore** (ADR-0090): FromRadio is read before anything else, so the system asks for the PIN inside the connection; a refused first write means the link is not paired; a radio silent for 5 s while it tells its configuration is a radio that does not answer. Radios with a screen show a random PIN, those without use 123456; the texts say both.
- **Other Meshtastic nodes are offered, not drawn yet**: the link tells the names and positions of the nodes it hears (`MeshtasticRadio.onNode`), beside the radio contract, which other kinds of radio cannot fill. A later change can put people who carry only a Meshtastic radio on the map.
- **Over Meshtastic, events are protected less than over MeshCore**, and the documentation says so: AES-CTR with no authentication lets anyone flip bits of a packet undetected, where MeshCore's 2-byte MAC catches most forgeries. Tesel's strict decoder is the only filter. This amends ADR-0006 and ADR-0010, whose application-level MAC, still to be evaluated, would protect both.

## Consequences

- A group can use Meshtastic radios, MeshCore radios or both. A Meshtastic radio does not hear a MeshCore one: a group with both kinds needs a member who bridges to the internet to join its two meshes.
- A third kind of radio is a package that implements `RadioLink` on the keeper and a service in the picker's list.
- Picking connects to the radio once to look at its services before its own code opens it; the connection is reused, so it costs no second pairing.
- Meshtastic's protocol changes more often than MeshCore's companion protocol. The fields Tesel reads have kept their numbers for years, but a firmware update that changes the handshake or the admin message would break the link; the tests pin what Tesel expects.
- Nothing has been tried with a real Meshtastic radio yet: the queue status after each packet, the admin message to the radio's own node without a session key, and Chrome's PIN prompt when FromRadio is read are as the firmware's source and documentation describe them, and need a field test.
- The MeshCore radio still estimates airtime on the EU narrow preset, whatever the radio is set to: reading its settings, as the Meshtastic link does, is left for later.
- Registering a port number of its own for Tesel, instead of the shared `PRIVATE_APP`, is possible later and would change only `MESHTASTIC_PORTNUM`.
