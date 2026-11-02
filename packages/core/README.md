# @tesel/core

Application logic shared by every client, independent of the UI and of any transport: deriving the current picture from events ([`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.4) and deciding what goes on the LoRa air, bridged events included (§4.2–4.3).

Pure TypeScript. Time and randomness are passed in, never read globally, so every behaviour can be tested deterministically.

| File                | Responsibility                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ordering.ts`       | Last-writer-wins ordering of events (protocol §3.10)                                                                              |
| `reducer.ts`        | Current state from a set of events, routed to the slices that read them; which positions the state has outlived                   |
| `state/`            | One slice per domain: members, positions, trails, chat and alerts, map objects, SOS, acknowledgements, tasks, roll call, journal  |
| `collections.ts`    | Immutable, idempotent updates of the collections in the state                                                                     |
| `lora-scheduler.ts` | What goes on the air and in what order: priorities, airtime budget, position thinning, SOS repeats, ACK rule and the bridge rules |
| `urgency.ts`        | How urgent each event type is, for the scheduler and for the app's queue of pushes to the server                                  |
| `airtime.ts`        | The airtime used in the last hour; how long one event takes is the radio link's estimate (`packages/radio`)                       |
| `geo.ts`            | Distances, bearings and areas on the Earth                                                                                        |
| `sweep.ts`          | The lanes of a sweep of an area, a strip's share of them, and how much of them trails have swept                                  |
| `simplify.ts`       | Thinning a line to the few points that keep its shape (Douglas–Peucker)                                                           |
| `token-bucket.ts`   | Rate limiting, used by the server's relay limits and the app's pushes                                                             |

The event log and the outbox, the queue of events waiting for the server, are storage, so they live in the app: `apps/web/src/lib/events/event-log.ts` keeps both in IndexedDB.

The scheduler decides what goes on the air but sends nothing itself. The group feed (`apps/web/src/lib/sync/group-feed.svelte.ts`) is where the transports meet: it offers own events and events from the server to the scheduler, queues events heard on LoRa in the outbox for the server, and, when a radio connects, offers it what `catchUpPackets` (`apps/web/src/lib/sync/lora-events.ts`) says it missed. The radio session (`apps/web/src/lib/radio/radio.svelte.ts`) asks the scheduler for the next packet and sends it.
