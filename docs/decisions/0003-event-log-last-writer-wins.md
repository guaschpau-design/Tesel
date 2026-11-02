# 0003. Event log with last-writer-wins instead of a CRDT library

- Status: Accepted, amended by [0044](0044-clocks-and-damaged-events.md) (each author's events stay in order) [0055](0055-forget-outlived-positions.md) (positions the trails have outlived are forgotten) and [0103](0103-rivals-full-storage-and-urgent-sync.md) (rivals under one `(origin, seq)`)
- Date: 2026-10-25

## Context

Several devices change shared state while partly or fully disconnected, over links that duplicate, delay and reorder messages. General-purpose CRDT libraries (Yjs, Automerge) solve this, but their update format is opaque and variable in size, and LoRa gives us 165 bytes per packet. Our shared state is simple: positions, chat lines, map objects, alerts. Collaborative editing of the same text is not needed.

## Decision

- Every change is an immutable event identified by `(origin, seq)`.
- State is a pure, idempotent, order-independent function of the set of events.
- Concurrent edits to the same map object resolve by last writer wins, ordered by `(timestamp, origin, seq)`.

## Consequences

- The model is easy to explain, test and implement in another language.
- Each event fits in one LoRa packet.
- Two people editing the same marker at the same moment: one edit wins. Acceptable for our objects.
- Ordering relies on device clocks. Phones are normally synchronised by the network or GPS. Wrong clocks do not affect delivery, but a clock that runs ahead wins concurrent edits until it is set right; a clock that went back is kept from undoing its own device's edits by [ADR-0044](0044-clocks-and-damaged-events.md).
