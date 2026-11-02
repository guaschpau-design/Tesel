# @tesel/protocol

The single implementation of [`docs/protocol.md`](../../docs/protocol.md): event encoding and decoding, group key derivation, internet envelopes, sealed radio frames, the relay's messages, invitation links, log files and the weather warnings a server publishes.

Pure TypeScript. No DOM, no Node APIs, no network. Runs unchanged in the browser, in Node and in tests. It defines the bytes; keeping them is not its job. The event log and the outbox live in the app (`apps/web/src/lib/events/event-log.ts`), and what goes on the radio is decided in `packages/core`.

| File            | Spec section                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `constants.ts`  | All numeric constants                                                            |
| `result.ts`     | Result type and error codes returned by every decoder                            |
| `bytes.ts`      | §1 conventions: little-endian reader and writer, UTF-8                           |
| `node-id.ts`    | §1 node IDs and event references                                                 |
| `base64url.ts`  | §1 base64url                                                                     |
| `events.ts`     | §3 event types as TypeScript types                                               |
| `codec.ts`      | §3 encoding, decoding and header peeking                                         |
| `payloads.ts`   | §3.3–3.12 the payload of every event type, writer next to reader                 |
| `fields.ts`     | §3 payload fields: references, texts, measurements, enumerations, shape geometry |
| `geometry.ts`   | §1, §3.7 coordinates and delta-encoded point lists                               |
| `sos-place.ts`  | §3.8 where an SOS was called from, or no place                                   |
| `crypto.ts`     | §1, §5 identity, key derivation, envelopes, sealed radio frames                  |
| `invitation.ts` | §6 invitation links                                                              |
| `relay.ts`      | §8 messages of the internet transport and server information                     |
| `weather.ts`    | §8.2 weather warnings                                                            |
| `log-file.ts`   | §10 log files                                                                    |

Bad input is answered in one of three ways, by who is at fault and what the caller can do with it:

- **A `Result` with an error code** (`result.ts`) from what decodes bytes or text another device or a user sent, when the reason matters: an event, an invitation, a log file, a client's message to the relay, which the relay answers with the code.
- **`null`** from what reads something that is either valid or useless, with nothing to tell about why: a server's message or information, base64url, an envelope that does not open with the group's key.
- **An exception** (`RangeError`) for a mistake in the calling code, such as a key or secret of the wrong size: it is a bug, not input to handle.

`test-helpers.ts` holds the fixtures of this package's tests, a round-trip sample of every event type among them; it is not exported.

To inspect an encoded event:

```sh
pnpm --filter @tesel/protocol decode 0104a1b2c3d4010000000013fc68486f6c61
```
