# 0099. Seal every radio frame with keys of Tesel's own

- Status: Accepted
- Date: 2026-11-02

## Context

Over the internet, every event is sealed with AES-256-GCM under a key derived from the group secret (protocol §5.1). Over LoRa, Tesel relied on the radio's channel encryption alone ([ADR-0010](0010-lora-link-security.md)), and that is weak:

- MeshCore encrypts channel traffic with AES-128 in ECB mode and authenticates it with an HMAC truncated to 2 bytes: one random packet in 65 536 passes the radio, and identical 16-byte blocks show as identical.
- Meshtastic encrypts with AES-128 in CTR mode and authenticates nothing ([ADR-0098](0098-meshtastic-radios.md)): anyone in range can flip chosen bits of a packet, a position's coordinates or an SOS's kind, and the radio passes it on. Only the strictness of Tesel's decoder stood between such a packet and the log.

Protocol version 1 is not frozen yet (v0.1.0 is unreleased), so the radio frame can still change in place. The owner approved spending about 12 bytes of each frame on it. Signatures stay out ([ADR-0052](0052-authorship-is-not-proven.md)): members are trusted; what is wanted here is that nobody outside the group can read, change or make up what the group sends by radio.

## Decision

- **Two more keys** are derived from the group secret like the others (protocol §5): the radio key (`info = "radio-key"`) and the radio MAC key (`info = "radio-mac"`), 32 bytes each. They serve nothing else, so the radio's AES-CTR keystream can never coincide with that of the internet envelopes, whose GCM nonces are derived from the event the same way under the content key.
- **Every radio frame is sealed** as a synthetic-IV construction (protocol §5.2): `frame = siv ‖ AES-256-CTR(radioKey, siv ‖ 00000000, event)`, with `siv` the first 12 bytes of `HMAC-SHA256(radioMacKey, event)`. A receiver decrypts, computes the HMAC of what it got and compares it with `siv` in constant time; a frame that does not match is dropped as if never heard.
  - Deterministic, as envelopes are ([ADR-0067](0067-envelope-nonce-from-the-event.md)): the same event gives the same frame, which keeps SOS repeats byte-identical and costs bridges nothing new.
  - Authenticated with 96 bits: a forgery or a flipped bit gets through once in 2⁹⁶ tries, where MeshCore let one in 2¹⁶ through and Meshtastic all.
  - 12 bytes of overhead and no padding. An event is at most 10 AES blocks, so the counter, the last 4 bytes of the counter block, never carries into the IV.
  - Built from the primitives the protocol package already uses (`@noble/ciphers`' AES-CTR, `@noble/hashes`' HMAC-SHA256, as for envelopes and event keys): no new dependency. AES-GCM-SIV, which the same library offers, adds a 16-byte tag to a nonce sent beside it, 28 bytes where 12 do; RFC 5297's SIV would bring AES-CMAC into the protocol for a 16-byte tag.
- **Events shrink from 165 to 153 bytes** (`MAX_EVENT_SIZE = MAX_RADIO_PAYLOAD − RADIO_SEAL_SIZE`), so a sealed event still fits MeshCore's largest channel datagram. Every limit derived from it follows: chat and roll calls 139 bytes of text, an alert 138, an SOS 128, a marker's label 121, a report's note 119, a task 117; a team 25 members with the longest name (28 before); a line or polygon 22 points in the app, 30 with an empty label (25 and 33 before).
- **Events written before stay readable.** Decoders accept events of up to 165 bytes, and their texts up to 12 bytes longer than encoders write (`MAX_DECODABLE_EVENT_SIZE`); envelopes, the relay and log files keep their limits, so those events are stored, synced and loaded as before. They no longer fit a frame: the radio leaves them off the air but lets the scheduler learn from them, as it would an SOS whose answers are urgent.
- **One boundary seals and opens**: the app's radio session (`apps/web/src/lib/radio/radio.svelte.ts`, with `radio-frames.ts`), where events go to the scheduler and frames come from the link. It seals with the keys of the active group, whose channel the radio carries, and opens each frame with the keys of the channel it came on, other groups' included; each group's keys are derived once. The scheduler weighs each packet's airtime at its sealed size. The radio packages (`packages/radio`, `packages/meshcore`, `packages/meshtastic`) carry frames and know nothing of Tesel's cryptography; the seal and the open live in `packages/protocol` beside the envelopes.
- **No transition.** Sealed MeshCore datagrams take a new `data_type`, `0xFF4E`, the next value of the development range, and `0xFF4D`, which carried events unsealed, is ignored. Meshtastic keeps `PRIVATE_APP`: a payload that does not open is dropped. The app is unreleased and every device updates itself, so devices of the old version simply stop hearing the new ones and are not misread by them.

This supersedes [ADR-0010](0010-lora-link-security.md), and amends [ADR-0098](0098-meshtastic-radios.md) (Meshtastic events are now authenticated), [ADR-0062](0062-teams.md) (25 members) and [ADR-0052](0052-authorship-is-not-proven.md) (LoRa keeps 153 of its 165 bytes for content).

## Consequences

- Over LoRa an outsider without the group secret can no longer read events, change them or make them up, on either kind of radio; the radio's own encryption becomes an outer layer. What is left to see is what any listener sees: that a frame was sent, its size, when, and that a repeat is the same as before.
- A replayed frame is a copy of an event the group has, and is de-duplicated like any copy. Frames bind no time, so a recorded SOS played back later would show the old call again only on a device that never had it.
- The channel key a radio holds is the group secret itself: whoever reads it from a radio, or from a radio app that shows or shares its channels, derives every key of the group, the radio's included, and can read and forge as a member. The seal guards against the radio's weak cipher, not against a leaked channel key. Giving the radio a key derived from the secret, so that a radio never holds the secret, is a separate change.
- Texts are 12 bytes shorter everywhere, since events are the same on every link ([ADR-0004](0004-one-binary-format-every-transport.md)). Forms and counters follow the protocol's constants and need no change of their own. A team written earlier with more than 25 members shows, but cannot be saved until it has 25.
- Devices of different development versions do not hear each other by radio. Over the internet they still do.
- MeshCore's `data_type` is still provisional: registering a permanent value before the first release remains to do (ADR-0006).
- Nothing has been tried with real radios yet: the frames are tested between radios in memory, and against a vector computed independently (protocol §5.2).
