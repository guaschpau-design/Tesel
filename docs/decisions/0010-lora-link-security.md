# 0010. Rely on MeshCore channel encryption for LoRa in v0.1, knowing its limits

- Status: Accepted, amended by [0098](0098-meshtastic-radios.md) (Meshtastic links, protected less)
- Date: 2026-10-25

## Context

The day-0 review asked us to verify how MeshCore protects channel traffic, because ARCHITECTURE.md presented it as plain "encryption". The MeshCore source (`src/Utils.cpp`, `encryptThenMAC`) shows that channel payloads are encrypted with **AES-128 in ECB mode**, zero-padded to 16-byte blocks, and authenticated with an **HMAC-SHA256 truncated to 2 bytes**, keyed with the channel secret.

Consequences of that design:

- ECB reveals when two 16-byte blocks are identical. Our events start with a header that changes with every `seq` and `time`, so identical blocks are rare; deliberate SOS repeats are byte-identical by design and reveal only that a repeat happened.
- A 2-byte MAC means an outsider who injects random packets is accepted by the radio about once in 65 536 tries. Such a packet decrypts to random bytes, which our decoder almost always rejects, but not with certainty.

Adding our own authentication tag inside each event would cost 8–16 of the 151 payload bytes.

## Decision

- v0.1 relies on MeshCore's channel encryption for LoRa traffic and documents its real strength instead of overstating it.
- Our decoder stays strict (exact lengths, ranges, UTF-8, node-ID checks), which filters almost every forged packet.
- An optional application-level MAC for LoRa events is evaluated after v0.1, together with signatures for the internet link (ADR-0005), in a new ADR.

## Consequences

- LoRa traffic is private against casual listeners, not against a capable adversary. User documentation says so plainly.
- The internet link is stronger (AES-256-GCM) than the LoRa link; bridges must never weaken it.
- If MeshCore improves its channel cryptography, we benefit without changes.
