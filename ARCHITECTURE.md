# Architecture

This document explains how Tesel is put together: the pieces, what each one owns, and how they talk. Read it before changing code. Decisions and their reasons live in [`docs/decisions/`](docs/decisions/); the wire format lives in [`docs/protocol.md`](docs/protocol.md).

> Product scope and goals are in [`docs/briefing.md`](docs/briefing.md) (Spanish). The name was chosen in [ADR-0019](docs/decisions/0019-name-tesel.md).

## 1. The idea in one paragraph

A group shares a map. Every change to that map — a position, a chat line, a marker, an SOS — is an **event**: a small, immutable, binary record with an author and a sequence number. Devices keep a local log of events and derive the current picture from it. Events travel over whatever link is available — the internet through a server, or LoRa through a MeshCore or Meshtastic radio — and are **byte-for-byte the same on every link**. Any device that has two links forwards events between them. There is no authority: whoever holds the group secret can read and write, and the server only ever sees ciphertext.

## 2. Components

```
┌─────────────────────────── apps/web (PWA) ────────────────────────────┐
│  UI (Svelte) ── map (MapLibre + PMTiles)                              │
│        │                                                              │
│        ▼                                                              │
│  group feed: event log and outbox (IndexedDB), relay and radio wiring │
│        │                                                              │
│        ▼                                                              │
│  packages/core: state reducer · LoRa scheduler, with bridge rules     │
│        │                                                              │
│        ▼                                                              │
│  packages/protocol: event codec · crypto · invitations                │
│        │                                   │                          │
│        │                          packages/radio: radio contract      │
│        │                                   │                          │
│  internet transport (WebSocket)   packages/meshcore, .../meshtastic   │
└────────┼───────────────────────────────────┼──────────────────────────┘
         │                                   │ BLE
         ▼                                   ▼
   apps/server (VPS)              MeshCore or Meshtastic radio
                                        ⇄ LoRa mesh ⇄ other radios
```

| Path                  | Owns                                                                                                                                                                     | Must not depend on                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `packages/protocol`   | Binary event format, key derivation, envelope encryption, the seal on radio frames, invitation links                                                                     | Anything else in the repo; the DOM; Node APIs        |
| `packages/core`       | State reducer; LoRa airtime scheduler, which decides what goes on the air and in what order, bridged events included                                                     | The DOM, Svelte, BLE, network APIs                   |
| `packages/radio`      | The contract between the app and a radio (`RadioLink`), and what every kind of radio shares: picking one over Web Bluetooth, pairing, the connection keeper, time on air | Anything else in the repo; the UI                    |
| `packages/meshcore`   | Talking to a MeshCore companion radio: connect, configure channel, send and receive datagrams                                                                            | `packages/core`, the UI                              |
| `packages/meshtastic` | Talking to a Meshtastic radio, with a protobuf codec of its own (ADR-0098): connect, configure channel, send and receive packets, the nodes it hears                     | `packages/core`, the UI, Meshtastic's GPL libraries  |
| `packages/scenario`   | Staged operations as data, planned into the events their members send                                                                                                    | The DOM, Node APIs, any transport                    |
| `apps/web`            | UI, map; each group's event log, outbox and sync cursors in IndexedDB; the group feed, which ties the log to the relay and the radio                                     | Server code                                          |
| `apps/server`         | Storing and relaying encrypted envelopes; serving the landing page and the web app (ADR-0017)                                                                            | Plaintext event contents (it can never decrypt them) |
| `apps/site`           | The landing page at tesel.eu: static HTML and CSS, Spanish and English                                                                                                   | Any build step or third-party request                |
| `tools/simulator`     | Scenarios played by simulated devices through the relay, for demos, load tests and screenshots                                                                           | The apps: it reaches them only through the protocol  |

The dependency direction is strictly downwards in the diagram. `protocol` and `core` are pure TypeScript with no I/O, so they run unchanged in the browser, in Node and in tests. This is what keeps the hard parts testable.

The event log and the outbox, the queue of events waiting for the server, are storage, so they live in the app and not in `core`. These files handle an event on its way:

| File                                         | Job                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/events/event-log.ts`       | Keeps each group's log in IndexedDB, and of rival events under one `(origin, seq)` what protocol §3.1 says |
| `apps/web/src/lib/events/own-events.ts`      | Numbers, stamps and stores this device's own events, with the outbox                                       |
| `apps/web/src/lib/events/outbox.ts`          | What waits for the server, and confirming what it stored                                                   |
| `apps/web/src/lib/events/held-events.ts`     | SOS calls, cancellations and acknowledgements there was no room to store, held in memory until there is    |
| `apps/web/src/lib/sync/group-feed.svelte.ts` | What the app holds of an open group: its picture, and the actions of this device, which publish events     |
| `apps/web/src/lib/sync/member-events.ts`     | The event each action publishes, built from its header                                                     |
| `apps/web/src/lib/sync/group-sync.svelte.ts` | Ties the log to the relay and the radio: stores what arrives, pushes the outbox, offers events to LoRa     |
| `apps/web/src/lib/sync/group-intake.ts`      | Stores what arrives and gives it to the picture, when storage is full too, and notes forged names          |
| `apps/web/src/lib/sync/feed-relay.ts`        | The relay side of it: opens what the server sends, seals and pushes the outbox, confirms what is stored    |
| `apps/web/src/lib/sync/lora-events.ts`       | What a radio is given when it connects (`catchUpPackets`)                                                  |
| `packages/core/src/lora-scheduler.ts`        | Decides what goes on the air and in what order, bridge rules included, so it can be tested with no radio   |
| `packages/core/src/air-news.ts`              | What is still worth the scheduler's airtime: positions thinned, history left off the air                   |
| `packages/core/src/sos-repeats.ts`           | This device's own SOS calls, which the scheduler repeats until someone answers them                        |
| `apps/web/src/lib/sync/log-file.ts`          | Saves a group's log to a file and loads one back (protocol §10)                                            |

## 3. Data model

### 3.1 Identity

Each device generates an Ed25519 key pair on first launch, when the user picks an alias, and never sends the private key anywhere. Its **node ID** is the first 4 bytes of `SHA-256(publicKey)`, shown as 8 hex characters. There are no accounts.

### 3.2 Group

A group is defined by a random 16-byte **group secret**. Everything else is derived from it (see [`docs/protocol.md`](docs/protocol.md) §5):

| Derived value             | Used for                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| The secret itself         | Radio channel key; the radio encrypts LoRa traffic with it             |
| Radio keys (2 × 32 bytes) | Tesel's own seal on every radio frame, inside the radio's encryption   |
| Group ID (16 bytes)       | Public routing identifier on servers; reveals nothing about the secret |
| Content key (32 bytes)    | AES-256-GCM encryption of events sent over the internet                |
| Event key (HMAC)          | Lets the server de-duplicate envelopes without learning who sent them  |

People join by scanning an **invitation** (QR code or link) that carries the group name, the secret, the role being granted and, optionally, a server URL. The secret travels in the URL fragment, which browsers never send to servers, and the app removes it from the address bar as soon as it has read it ([ADR-0012](docs/decisions/0012-invitation-links-under-a-base-path.md)). A QR code can be scanned with the phone's camera app, which opens the link, or from inside the app. On iPhone only the second works for an installed app, whose storage is separate from Safari's.

A device can belong to several groups; one is **active** at a time. Joining a group the device already belongs to never demotes it: a coordinator invitation promotes a member, a member invitation changes nothing.

Roles (coordinator, member) are carried in invitations and shown in the UI. In v0.1 they are **advisory**: anyone holding the secret is technically able to send any event. The UI applies these rules, which the protocol does not enforce:

| Action                                     | Who, in the UI              |
| ------------------------------------------ | --------------------------- |
| Create invitations (member or coordinator) | Coordinators                |
| Send alerts                                | Coordinators                |
| Cancel an SOS                              | Its sender and coordinators |
| Draw, edit and delete map objects          | Everyone                    |
| Send an SOS, chat, acknowledge             | Everyone                    |

#### Position privacy

The device reads its GPS only while something uses it — sharing, showing it on the map, navigating — through one reader (`lib/position/device-location.svelte.ts`) that every use shares. Each device chooses how it shares its position, and remembers the choice: **sharing** (positions are published as the device moves), **paused** (nothing new is published; the group keeps the last position, which turns stale) or **hidden** (a `POSITION_HIDDEN` removes the device from the group's map). See [ADR-0005](docs/decisions/0005-group-secret-trust-boundary.md). A device that shares and joins a group it was not in asks whether to share there, and pauses sharing otherwise, so an invitation from someone posing as the user's team does not take the position with it ([ADR-0110](docs/decisions/0110-deception-and-loose-ends.md)).

### 3.3 Events

An event has a fixed 14-byte header — protocol version, type, origin node ID, sequence number, timestamp — followed by a type-specific payload. The full list of types and their byte layouts is in [`docs/protocol.md`](docs/protocol.md) §3. In short:

| Type                               | Purpose                                                     |
| ---------------------------------- | ----------------------------------------------------------- |
| `MEMBER_INFO`                      | Alias, role and public key of a member                      |
| `POSITION`, `POSITION_HIDDEN`      | Live position, or "I stopped sharing"                       |
| `CHAT`                             | Group chat line                                             |
| `MARKER`, `SHAPE`, `OBJECT_DELETE` | Map objects: points, lines, polygons, circles               |
| `SOS`, `SOS_CANCEL`                | Emergency call and its cancellation                         |
| `ALERT`                            | Broadcast warning with a severity level                     |
| `ACK`                              | Acknowledges an event (used for SOS, alerts and roll calls) |
| `TASK`                             | Creates or changes a task: what, who and where (ADR-0025)   |
| `ROLL_CALL`                        | Asks every member to answer with an `ACK` (ADR-0028)        |
| `SWEEP`                            | One strip of a search area's parallel lanes (ADR-0060)      |
| `MEMBER_STATE`                     | What a member is doing and carries (ADR-0061)               |
| `TEAM`                             | Creates or changes a team (ADR-0062)                        |
| `REPORT`                           | A situation report in a fixed form (ADR-0063)               |
| `CHECK_IN_TIMER`                   | Sets when the safety check-in asks (ADR-0064)               |
| `ZONE_CROSSING`                    | A member entered or left an area of the group (ADR-0122)    |

`(origin, seq)` identifies an event in its group. Sequence numbers are per device and group, normally increase by one and are persisted, so a device never reuses one in a group; each group has a counter of its own, so members of one group cannot count a device's events in its others ([ADR-0111](docs/decisions/0111-airtime-kept-numbers-per-group.md)). Nothing proves who wrote an event, though (ADR-0052), so a member can write under another's `(origin, seq)`, and even take a number its owner has not used yet. Different events under one `(origin, seq)` are **rivals**: every device keeps the same of them whatever order they arrive in, every SOS, cancellation and acknowledgement among them, or else the one whose bytes come first; the app tells the user someone writes under that member's name, and a device that sees its own name on a number it has not used skips past it ([ADR-0103](docs/decisions/0103-rivals-full-storage-and-urgent-sync.md)).

### 3.4 Deriving state

The current picture is a pure function of the event log, computed by the reducer in `packages/core`. The state is composed of **slices**, one module per domain in `packages/core/src/state/`: each declares the event types it reads, its empty value and how one more event changes it. The reducer routes each event to the slices that read it and leaves the others untouched, so unchanged slices keep their identity and the UI only recomputes what changed.

- **Members:** latest `MEMBER_INFO` per origin.
- **Positions:** latest `POSITION` or `POSITION_HIDDEN` per origin.
- **Trails:** the newest positions of each origin, in order, for drawing where members have been. The app draws from them only real moves, leaving out the GPS wandering within its error ([ADR-0092](docs/decisions/0092-moves-not-gps-wandering.md)). A `POSITION_HIDDEN` cuts the trail: positions up to it are dropped, so hiding also hides where one went.
- **Map objects:** identified by the `(origin, seq)` of the event that created them. Later `MARKER`/`SHAPE`/`SWEEP` events for the same object replace it; `OBJECT_DELETE` removes it. Conflicts resolve by **last writer wins**, ordering by `(timestamp, origin, seq)`.
- **Member states:** latest `MEMBER_STATE` per origin.
- **Tasks:** like map objects, identified by the `(origin, seq)` of the event that created them, and the last writer wins.
- **Teams:** the newest `TEAM` per team.
- **Chat, alerts, reports and zone crossings:** append-only, ordered by `(timestamp, origin, seq)` so every device shows the same order.
- **Check-in:** the newest `CHECK_IN_TIMER`.
- **SOS:** every `SOS` is kept; one is active until a `SOS_CANCEL` for it arrives, and the first cancellation (by the same order) says who cancelled it.
- **Roll call:** the newest `ROLL_CALL`; its answers are the acknowledgements of it.
- **Acknowledgements:** per acknowledged event, the first `ACK` of each member.
- **Journal:** every event except positions, in order: the record from which the app writes the operation diary ([ADR-0022](docs/decisions/0022-log-files.md)).

Events can arrive late, twice or out of order — through LoRa, a bridge and the server at once. The reducer is idempotent and order-independent, so this never matters. This is the property the tests protect most. See [ADR-0003](docs/decisions/0003-event-log-last-writer-wins.md).

Most of a long operation's events are positions that no trail shows any more. A device forgets them: once a member's trail has **outlived** a position (it is older than every point of a full trail, or not newer than the member's last hiding), no later event can bring it back, so the state of the events kept is the state of all of them. Copies of an outlived position that arrive later are taken as known. The log stays at each member's trail plus the journal, however long the operation ([ADR-0055](docs/decisions/0055-forget-outlived-positions.md)).

### 3.5 Adding an event type

A new capability is a new event type (protocol §3.2 and §9: no version change). It touches one place in each layer, and the compiler or a test points at any that is missing:

1. **Spec first:** its code and layout in [`docs/protocol.md`](docs/protocol.md) §3, its size within the 153-byte budget.
2. **Protocol:** the type in `packages/protocol/src/events.ts`, the code in `constants.ts`, and its layout (writer next to reader) in `payloads.ts`, whose record is keyed by every event type. A round-trip sample goes in `test-helpers.ts`; a test fails while a type has none.
3. **State:** a slice in `packages/core/src/state/`, or an existing slice that also reads the type, listed in `reducer.ts`. A test fails while a known type has no slice.
4. **Radio:** its urgency in `packages/core/src/urgency.ts`, a record keyed by every event type.
5. **App:** the action that publishes it in `GroupFeed` (`apps/web/src/lib/sync/group-feed.svelte.ts`), with the event it builds in `member-events.ts` beside it, and the UI that shows it, with texts in both languages.

## 4. Transports

### 4.1 Internet

The web app keeps a WebSocket to the active group's server; groups that are not active sync when they are opened. Each event is sealed into an **envelope** — AES-256-GCM ciphertext plus an opaque event key — and pushed. The server assigns each envelope a per-group **cursor** (an increasing integer), stores it, and fans it out to the group's other connections. On reconnect a client asks for everything after the last cursor it saw. Envelopes that arrive together are handled in batches of up to a thousand: each batch is stored in one transaction together with its cursor, which therefore never runs ahead of the log, and applied to the state in one update. A device back after hours without coverage catches up in seconds rather than one envelope per screen frame. While more than four batches wait to be stored, the client takes no more and joins again once they are in, from the cursor stored with them, so a backlog never piles up in memory; a batch that cannot be stored leaves the cursor behind it, and the link still reaches `synced`, pushes the outbox and joins again later. An own SOS, its cancellation or an acknowledgement is pushed as soon as the device has joined, ahead of the backlog; the rest of the outbox once the backlog is in ([ADR-0103](docs/decisions/0103-rivals-full-storage-and-urgent-sync.md)). The server cannot read, forge or alter events; it can only drop them.

### 4.2 LoRa (MeshCore and Meshtastic)

The web app connects to a radio over Web Bluetooth (Chrome and Edge; Bluefy on the iPhone). One picker lists radios of both kinds Tesel speaks, and the radio's Bluetooth service says which it is; only that kind's package is then loaded ([ADR-0098](docs/decisions/0098-meshtastic-radios.md)). Every kind implements one contract, `RadioLink` in `packages/radio`, on one connection keeper: commands one at a time with a time limit, and a lost link connected again by itself, with pauses that start short again only once a link has stayed up a minute. Each time the radio is ready, the radio session links the active group to it, and a link that fails is tried again by itself ([ADR-0104](docs/decisions/0104-sos-across-drops-and-groups.md)).

- A **MeshCore** companion radio stores the group secret in one of its channel slots, and each event, sealed, goes out as a **channel data datagram** with Tesel's `data_type`. The radio floods it through the mesh and encrypts it with the channel key; other radios on the same channel deliver it to their apps. See [ADR-0006](docs/decisions/0006-meshcore-first-channel-datagrams.md).
- A **Meshtastic** radio holds the group secret as the key of one of its secondary channels, named after the group, and each event, sealed, goes out as a packet to everyone on that channel, on the `PRIVATE_APP` port. Tesel speaks to it with a protobuf codec of its own, since Meshtastic's libraries are GPL ([ADR-0098](docs/decisions/0098-meshtastic-radios.md)). The link also tells the names and positions of the other Meshtastic nodes it hears, for people who carry a radio without Tesel.

The two kinds do not hear each other: a group with both reaches all its members through those who bridge to the internet (§4.3).

Both kinds encrypt with the channel key, weakly: MeshCore with AES-128-ECB and a 2-byte MAC, Meshtastic with AES-128-CTR and no MAC at all. So Tesel seals every event it puts on the air with keys of its own, derived from the group secret: a 12-byte synthetic IV, an HMAC of the event, followed by the event in AES-256-CTR (protocol §5.2, [ADR-0099](docs/decisions/0099-sealed-radio-frames.md)). The radio session (`apps/web/src/lib/radio/radio.svelte.ts`, which sends through `radio-sender.svelte.ts`) is the one place that seals what goes out, with the active group's keys, and opens what comes in, with the keys of the channel it came on; a frame that does not open is dropped as if never heard. The radio packages carry frames and never see an event. Events are at most 153 bytes, so a sealed one fits MeshCore's 165-byte datagram; an event of up to 165 bytes written before frames were sealed still decodes and travels over the internet, but stays off the air.

LoRa is slow and legally limited to 10 % airtime in the EU 869.4–869.65 MHz sub-band, so outgoing LoRa traffic goes through a **scheduler** in `packages/core` ([ADR-0015](docs/decisions/0015-lora-airtime-policy.md)) that:

1. Orders events by urgency, given for every event type in `packages/core/src/urgency.ts`: the SOS and its cancellation first, then alerts and roll calls, hiding a position, acknowledgements, chat and tasks, map objects, member information and, last, positions. `POSITION_HIDDEN` is never thinned or delayed, and it drops any position still queued: a user who stops sharing must disappear from the map promptly.
2. Estimates each packet's airtime, at its sealed size, as the linked radio says (`RadioLink.airtimeMs`: MeshCore's EU narrow preset, or the Meshtastic radio's own LoRa settings) and keeps a rolling one-hour budget: 5 % of the hour for ordinary traffic, the legal 10 % for events as urgent as an alert or more (`SOS`, `SOS_CANCEL`, `ALERT`, `ROLL_CALL`, and an `ACK` of an SOS, a critical alert or a roll call). The airtime spent is kept on the device and counted again when a radio connects, so a reload does not give the radio a fresh budget, and one window of the app at a time drives the radio ([ADR-0111](docs/decisions/0111-airtime-kept-numbers-per-group.md)).
3. Thins own positions: at most one every 2 minutes, and only after moving 50 m or 10 minutes passing. A position older than the member's newest position or hiding, sent or heard, is never sent.
4. Repeats an own `SOS` with back-off (30 s, doubling to 5 minutes) until an `ACK` or a `SOS_CANCEL` arrives over any transport. It keeps repeating after another group is opened, on its own group's channel, which the radio still holds, sealed with that group's keys; the app warns, before opening another group, that the call then goes only by radio ([ADR-0104](docs/decisions/0104-sos-across-drops-and-groups.md)).
5. Applies the protocol's ACK rule: an own `ACK` waits 2–30 s and is dropped if another member's `ACK` is heard first, except the answer to a roll call, which every member sends. A bridged `ACK` of the same event is dropped too: the sender heard the one on the air.
6. Keeps at most 500 packets waiting; beyond that the least urgent go, bridged before own.

When a radio links to a group, the group feed gives it what it missed while there was none (`catchUpPackets` in `apps/web/src/lib/sync/lora-events.ts`, [ADR-0043](docs/decisions/0043-radio-delivery.md)): the device's own latest `MEMBER_INFO`, so members who only hear the radio learn its alias; its own SOS calls still open that nobody has answered; and its own events still in the outbox that have not been on the air. Before that, the scheduler learns the group's SOS calls and their cancellations (`standingEvents`), so that acknowledgements of them are urgent however long ago they were sent; the app no longer sends alerts or roll calls ([ADR-0070](docs/decisions/0070-a-simpler-app.md)). A frame that does not decode and is not of an unknown type is damaged: it is neither kept nor taken as heard, so it cannot stand in for the real event. An own event sent by radio is marked as aired and stays in the outbox until a server stores it; for a group with no server, the radio send is the delivery.

While connected, Tesel reads every message the radio holds. A frame heard on the channel of another of this device's groups goes to that group's log, and to its outbox if the group has a server; an SOS among them raises the alarm at once, with the group's name and a way to open it. Each SOS sounds once on a device, whichever way it came (`apps/web/src/lib/incidents/alarmed-sos.ts`). Text messages of other apps, MeshCore or Meshtastic chat, are kept on the device and shown, read-only, in a tab of the chat of their own, so they are not lost.

### 4.3 Bridging

A device connected to both the server and a radio is a **bridge**, with no configuration. The group feed passes events between the two links; the scheduler decides which bridged events go on the air, and when:

- Every event heard on LoRa is stored in the log and queued in the outbox for the server.
- Events from the server are offered to the scheduler as bridged. Positions are forwarded at most once every 5 minutes per origin. Events older than 10 minutes are history rather than news and are not forwarded, except those that still call for action: an SOS not cancelled, its cancellation, alerts and roll calls ([ADR-0043](docs/decisions/0043-radio-delivery.md)).
- To avoid several bridges repeating the same event over the air, a bridge waits a random 0–10 seconds before forwarding to LoRa and skips the event if it has meanwhile heard it on LoRa.
- An event already seen on a transport is never sent back to that transport.

## 5. Operating modes

The code is the same in every mode; what differs is what is reachable.

| Mode      | Reachable  | Behaviour                                                                                   |
| --------- | ---------- | ------------------------------------------------------------------------------------------- |
| Connected | Server     | Sync through the group's server; LoRa as fallback if paired                                 |
| Mesh      | Radio only | Events flow radio to radio; each device keeps its own log                                   |
| Bridged   | Both       | A device with a radio and the internet passes events between the mesh and the server (§4.3) |

A group has one server. Where there is no internet, the radios carry what matters: positions, SOS calls, alerts and chat. Any phone with a radio and some internet, from a hotspot, a 4G router or a satellite terminal, bridges the mesh to the server with no setup. [ADR-0058](docs/decisions/0058-no-command-posts.md) explains why there is no local server for a base without internet.

## 6. Persistence

| Where   | What                                                                                                                          | Technology                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Browser | Identity keys, groups, settings, each group's event log, the outbox and sync cursors                                          | IndexedDB database `tesel`                                               |
| Browser | Offline map tiles by source, with who needs them, and the latest tiles seen online                                            | IndexedDB database `tesel-map`, separate so it can be cleared on its own |
| File    | A group's log, saved and loaded by hand: its events sealed as for a relay (protocol §10, `apps/web/src/lib/sync/log-file.ts`) | JSON                                                                     |
| Server  | Encrypted envelopes per group, with retention limit                                                                           | SQLite through `node:sqlite`                                             |
| Server  | Base map                                                                                                                      | One PMTiles file, served as a static file with range requests            |

The browser is asked to keep the app's storage from the moment the device has an identity. The group's log comes first: maps are stored only with room left for it, tiles seen online are the first thing dropped when the storage is full, and a write refused for lack of room is told to the user without losing the outbox ([ADR-0056](docs/decisions/0056-storage-and-offline-maps.md)). A write of the log refused for lack of room frees the tiles seen online and is tried again; if there is still no room, SOS calls, their cancellations and acknowledgements reach the picture, the alarm and the server all the same, held in memory until they can be stored ([ADR-0103](docs/decisions/0103-rivals-full-storage-and-urgent-sync.md)).

## 7. Maps

The base map is OpenStreetMap data rendered as vector tiles from a single PMTiles file that **we host**. The public OpenStreetMap tile servers forbid bulk downloading, so they cannot be used for offline maps. To prepare for an incident, the web app downloads every tile of an area straight from that file, up to zoom 15 or less for a large area, and stores it in IndexedDB. MapLibre reads tiles through a `tesel-tiles://` protocol that answers from IndexedDB first and the network second. Glyphs and sprites ship inside the app. See [ADR-0007](docs/decisions/0007-self-hosted-vector-maps.md) and [ADR-0011](docs/decisions/0011-client-side-area-download.md).

Two more base maps cover Spain, Portugal and southern France, from open national services the browser reads directly through the same protocol: the satellite map, one Sentinel-2 mosaic from afar and each country's orthophotos close up, joined on the device where a tile crosses a border ([ADR-0023](docs/decisions/0023-ign-base-maps.md), [ADR-0041](docs/decisions/0041-satellite-mosaic-and-national-photos.md); the mosaic's licence and how a build changes it, [ADR-0051](docs/decisions/0051-satellite-mosaic-licence.md)), and a topographic map, which is the street map in another palette with contour lines worked out on the device from the elevation, and IGN's names of the terrain in Spain ([ADR-0034](docs/decisions/0034-vector-topographic-map.md)). The elevation — relief shading, contour lines, the climb of a way — comes from Mapterhorn's tiles, built from each country's best open model. An offline area can include any of them, each to the zoom it needs (`lib/offline/offline-maps.ts`): the satellite map three zooms deeper than the street map, to zoom 18, since a photograph cannot be enlarged without blurring; the elevation to zoom 13, where a pixel is already about 10 m; IGN's names as deep as the street map. Every downloaded tile is kept under its source. A download asks our own map for six tiles at a time and the public services for two, so as not to weigh on services we do not run; it tries a failing tile again, and one that stops short can be resumed. With no area downloaded, the map still shows an overview of the base map, its zooms 0 to 6, kept at the first start with a connection, and the places looked at online lately ([ADR-0056](docs/decisions/0056-storage-and-offline-maps.md)). The cadastres' parcels, of Spain and France, are a layer drawn from one picture of the view at a time, asked for online, since Spain's service forbids tiles and downloads ([ADR-0036](docs/decisions/0036-cadastre-layer.md)).

## 8. Security model

| Threat                                 | Mitigation in v0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server operator reads the group's data | Not from what it relays: events are end-to-end encrypted with a key the server never sees                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Eavesdropper on LoRa                   | Tesel seals every radio frame with keys derived from the group secret, AES-256-CTR and a 96-bit HMAC-SHA256 synthetic IV, inside the radio's own weak channel encryption: an outsider can neither read, change nor make up events. The channel key a radio holds is the group secret itself, so whoever reads it out of a radio or its app holds the whole group ([ADR-0099](docs/decisions/0099-sealed-radio-frames.md))                                                                                                                                                                                                                                                  |
| Outsider joins the group               | Requires the secret, which only travels inside invitations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Member impersonates another member     | **Not prevented in protocol version 1** — anyone with the secret can forge any origin; members are trusted as the group is, and the interface never shows an author as verified ([ADR-0052](docs/decisions/0052-authorship-is-not-proven.md)). An event forged under another's `(origin, seq)` cannot hide an SOS, and the app says someone writes under that member's name ([ADR-0103](docs/decisions/0103-rivals-full-storage-and-urgent-sync.md))                                                                                                                                                                                                                       |
| Server serves a changed app            | Whoever serves the app's code is trusted, as with any web app. Servers run only images signed by the project's CI and check them before updating ([ADR-0049](docs/decisions/0049-signed-images-and-checked-updates.md)); the app's Content-Security-Policy keeps it from loading code from elsewhere; an installed app runs the version it has until its user accepts an update                                                                                                                                                                                                                                                                                            |
| Lost or seized phone                   | Group secrets and the device key sit unencrypted in the browser's storage, protected only by the phone's own lock. Leaving a group deletes its secret from the device                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Leaked secret                          | Coordinator creates a new group and re-invites; key rotation is future work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Server flooded with junk               | Limits on open connections (in all and per client address), on joins and new groups per address, on messages per connection, and on pushes per connection, group, address and in all, the server's share fairly divided and half of it kept for groups older than a day; what an address and a new group store in a day is limited, and pushes are refused with the disk nearly full ([ADR-0045](docs/decisions/0045-server-keeps-every-distinct-envelope.md), [ADR-0107](docs/decisions/0107-relay-holds-against-floods.md)). An operator can purge one group's junk. The group ID is enough to push envelopes; a membership token derived from the secret is future work |
| Traffic analysis                       | **Not prevented in v0.1** — a relay sees each envelope's size, which tells its event's type (an SOS is recognisable), and when it is sent; map servers see which areas a device views. Padding envelopes to one size is left for a later protocol version                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 9. Repository layout

```
apps/web/            PWA: UI, map, event log and outbox, transport wiring
apps/server/         Relay and storage server, serves site and app
apps/site/           Landing page (static)
brand/               Mark, wordmark and lockups (SVG) and the script that builds them
packages/protocol/   Wire format, crypto, invitations (pure TS)
packages/core/       Reducer, LoRa scheduler with its bridge rules (pure TS)
packages/radio/      The radio contract and what every kind of radio shares
packages/meshcore/   MeshCore radio adapter
packages/meshtastic/ Meshtastic radio adapter
packages/scenario/   Staged operations as data and their plan (pure TS), for the simulator
tools/simulator/     Scenarios played by simulated devices: demos, load tests, screenshots
docs/                Briefing, protocol spec, decisions
deploy/              VPS installer and configuration, GitHub Pages redirect
```
