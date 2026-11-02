# Tesel protocol, version 1

This is the normative specification of everything Tesel puts on the wire. It is written so that someone could build a compatible implementation without reading our code. When code and this document disagree, the document wins and the code is a bug — unless the pull request changes both.

Keywords MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## 1. Conventions

- Multi-byte integers are **little-endian**, matching MeshCore.
- `u8`, `u16`, `u32` are unsigned; `i16`, `i32` are two's-complement signed.
- Text is UTF-8. Encoders MUST NOT split a code point; decoders MUST reject invalid UTF-8.
- A **text-rest** field is the last field of a payload and runs to its end, with no length prefix.
- A **text-u8** field is a `u8` byte length followed by that many bytes.
- **Coordinates** are `i32` in units of 10⁻⁷ degrees (about 1.1 cm). Latitude is within ±90°, longitude within ±180°; decoders MUST reject values outside these ranges.
- **Node ID**: 4 bytes, the first 4 bytes of `SHA-256(ed25519PublicKey)`.
- **Event reference**: 8 bytes, a node ID followed by a `u32` sequence number. It points to the event with that `(origin, seq)`.
- `base64url` means RFC 4648 §5 without padding.

## 2. Size budget

The largest MeshCore channel datagram payload is **165 bytes**; a Meshtastic packet carries more. Every event, on every transport, MUST be at most 165 bytes once encoded. Encoders MUST refuse to produce larger events; the user interface is responsible for keeping text short enough.

## 3. Events

### 3.1 Header

Every event starts with a 14-byte header:

| Offset | Size | Field     | Notes                                                           |
| ------ | ---- | --------- | --------------------------------------------------------------- |
| 0      | 1    | `version` | `u8`, `1` for this specification                                |
| 1      | 1    | `type`    | `u8`, see §3.2                                                  |
| 2      | 4    | `origin`  | Node ID of the author                                           |
| 6      | 4    | `seq`     | `u32`, per-origin sequence number, starting at 1                |
| 10     | 4    | `time`    | `u32`, seconds since 1970-01-01 UTC, when the event was created |

The payload follows, up to 151 bytes.

- A device MUST persist its last `seq` and MUST NOT reuse a value. It SHOULD increase `seq` by exactly one per event, so receivers can detect gaps. `seq` `0` is invalid.
- A device MUST NOT stamp an event with a `time` earlier than that of its previous event: if its clock has gone back, it uses the previous event's `time`. So, among one author's events, the newest by `(time, origin, seq)` is always the last one written.
- `(origin, seq)` identifies an event globally within a group. Receivers MUST treat a second copy as a duplicate, whatever transport it came from.
- Receivers MUST ignore events whose `version` they do not support, and events whose `type` they do not know. They MUST NOT treat these as errors that affect other events.
- Receivers MUST discard an event of a known `type` whose payload does not decode, and MUST NOT record its `(origin, seq)` as received: a damaged copy must not stand in for the real event.
- Bridges and servers MUST forward events of unknown type unchanged, using the header alone for de-duplication. This lets newer clients use new types through older infrastructure.
- **Reserved values.** When an enumerated field holds a reserved value, decoders MUST use the default given for that field below, so that newer senders never make older receivers drop information. The one exception is `SHAPE.kind`, whose geometry cannot be parsed without it; an event with a reserved shape kind is ignored.

### 3.2 Types

| Code   | Name              | Payload                                                |
| ------ | ----------------- | ------------------------------------------------------ |
| `0x01` | `MEMBER_INFO`     | §3.3                                                   |
| `0x02` | `POSITION`        | §3.4                                                   |
| `0x03` | `POSITION_HIDDEN` | Empty                                                  |
| `0x04` | `CHAT`            | §3.5                                                   |
| `0x05` | `MARKER`          | §3.6                                                   |
| `0x06` | `SHAPE`           | §3.7                                                   |
| `0x07` | `OBJECT_DELETE`   | Object reference (8 bytes)                             |
| `0x08` | `SOS`             | §3.8                                                   |
| `0x09` | `SOS_CANCEL`      | Event reference (8 bytes) of the `SOS` being cancelled |
| `0x0A` | `ALERT`           | §3.9                                                   |
| `0x0B` | `ACK`             | Event reference (8 bytes) of the event acknowledged    |
| `0x0C` | `TASK`            | §3.11                                                  |
| `0x0D` | `ROLL_CALL`       | §3.12                                                  |
| `0x0E` | `SWEEP`           | §3.13                                                  |
| `0x0F` | `MEMBER_STATE`    | §3.14                                                  |
| `0x10` | `TEAM`            | §3.15                                                  |
| `0x11` | `REPORT`          | §3.16                                                  |
| `0x12` | `CHECK_IN_TIMER`  | §3.17                                                  |

Codes are never reused. New capabilities are added as new types; existing layouts never change within version 1.

### 3.3 `MEMBER_INFO`

Announces who is behind a node ID. Sent on joining a group and when alias or role changes; over LoRa, also each time a radio starts carrying the group, so members who only hear the radio learn it.

| Size | Field       | Notes                                                                     |
| ---- | ----------- | ------------------------------------------------------------------------- |
| 1    | `role`      | `0` member, `1` coordinator; reserved values read as member               |
| 32   | `publicKey` | Ed25519 public key; receivers MUST check that its node ID equals `origin` |
| 1–32 | `alias`     | text-rest                                                                 |

### 3.4 `POSITION` and `POSITION_HIDDEN`

`POSITION` payload:

| Size | Field      | Notes                                           |
| ---- | ---------- | ----------------------------------------------- |
| 4    | `lat`      | Coordinate                                      |
| 4    | `lon`      | Coordinate                                      |
| 2    | `accuracy` | `u16`, metres, `0xFFFF` unknown                 |
| 2    | `heading`  | `u16`, degrees 0–359, `0xFFFF` unknown          |
| 2    | `speed`    | `u16`, centimetres per second, `0xFFFF` unknown |

Encoded size: 28 bytes. An event whose `heading` is from 360 to `0xFFFE` is discarded.

`POSITION_HIDDEN` has no payload. It means "I stopped sharing my position"; receivers MUST stop showing the origin's last position until a newer `POSITION` arrives. As with objects, the newer of the two is decided by `(time, seq)`.

### 3.5 `CHAT`

| Size  | Field             |
| ----- | ----------------- |
| 1–151 | `text`, text-rest |

### 3.6 `MARKER`

Creates or replaces a point object.

| Size  | Field    | Notes                       |
| ----- | -------- | --------------------------- |
| 8     | `object` | Object reference, see §3.10 |
| 2     | `symbol` | `u16`, see §4               |
| 4     | `lat`    | Coordinate                  |
| 4     | `lon`    | Coordinate                  |
| 0–133 | `label`  | text-rest                   |

### 3.7 `SHAPE`

Creates or replaces a line, polygon or circle.

| Size | Field      | Notes                                                                    |
| ---- | ---------- | ------------------------------------------------------------------------ |
| 8    | `object`   | Object reference, see §3.10                                              |
| 1    | `kind`     | `1` polyline, `2` polygon, `3` circle; reserved values: ignore the event |
| 2    | `style`    | `u16`, see §4.2                                                          |
| 1+n  | `label`    | text-u8, 0–32 bytes                                                      |
| …    | `geometry` | Depends on `kind`                                                        |

**Polyline and polygon geometry:**

| Size            | Field   | Notes                                                                                                               |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 1               | `count` | `u8`, number of points; at least 2 for a polyline, 3 for a polygon                                                  |
| 4               | `lat0`  | First point, coordinate                                                                                             |
| 4               | `lon0`  | First point, coordinate                                                                                             |
| 4 × (count − 1) | deltas  | For each further point: `i16 dLat`, `i16 dLon` in units of 10⁻⁵ degrees, relative to the previous **decoded** point |

A decoder reconstructs point _i_ as point _i − 1_ plus `delta × 100` in coordinate units. An encoder MUST compute each delta from the previously reconstructed point, not from the original one, so rounding errors do not accumulate. If two consecutive points are more than 0.32767° apart on either axis, the encoder MUST insert intermediate points or reject the shape. Polygons are implicitly closed; the last point MUST NOT repeat the first.

With an empty label, a shape holds up to 33 points.

**Circle geometry:**

| Size | Field    | Notes                         |
| ---- | -------- | ----------------------------- |
| 4    | `lat`    | Centre, coordinate            |
| 4    | `lon`    | Centre, coordinate            |
| 4    | `radius` | `u32`, metres, greater than 0 |

### 3.8 `SOS`

| Size  | Field      | Notes                                                                                                     |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1     | `kind`     | `0` general, `1` medical, `2` trapped, `3` fire, `4` security; other values reserved and shown as general |
| 4     | `lat`      | Coordinate                                                                                                |
| 4     | `lon`      | Coordinate                                                                                                |
| 2     | `accuracy` | `u16`, metres, `0xFFFF` unknown                                                                           |
| 0–140 | `text`     | text-rest                                                                                                 |

A sender without a position MUST NOT hold the call back for one: it sends `lat` and `lon` `0` with `accuracy` `0xFFFF`, which receivers MUST read as "no place" and not as a point at 0°, 0°. Its `POSITION` follows as soon as it has one, whatever its sharing setting, and receivers SHOULD show it as where the caller is.

An `SOS` stays active until a `SOS_CANCEL` referencing it is received. Any member MAY cancel an SOS; the interface SHOULD show who cancelled it. Senders SHOULD repeat an `SOS` over LoRa with back-off until at least one `ACK` for it is received. Repeats are byte-identical copies, so receivers de-duplicate them.

**Acknowledging over LoRa.** To keep acknowledgements from flooding the air, a receiver SHOULD send at most one `ACK` per `SOS` or critical `ALERT`, after a random delay of 2–30 seconds, and SHOULD NOT send it if it has meanwhile heard another member's `ACK` for the same event. Over the internet, every receiver MAY acknowledge immediately. Answers to a `ROLL_CALL` are the exception (§3.12).

### 3.9 `ALERT`

| Size  | Field   | Notes                                                                       |
| ----- | ------- | --------------------------------------------------------------------------- |
| 1     | `level` | `0` information, `1` warning, `2` critical; reserved values read as warning |
| 1–150 | `text`  | text-rest                                                                   |

### 3.10 Objects

Map objects (`MARKER`, `SHAPE`, `SWEEP`) are identified by an **object reference**: the event reference of the event that created the object.

- To create an object, an event uses its own `(origin, seq)` as `object`.
- To change an object, any member sends a new `MARKER`, `SHAPE` or `SWEEP` with the same `object`. A change MAY switch between these types.
- To delete it, a member sends `OBJECT_DELETE` with the same `object`.
- The current state of an object is given by the event with the greatest `(time, origin, seq)` among all events with that `object`, compared in that order, with `origin` compared as 4 unsigned bytes. If that event is an `OBJECT_DELETE`, the object does not exist.
- Deletion is ordinary last-writer-wins: an edit newer than the delete brings the object back, and an older edit arriving late does not. This is intended; receivers MUST keep `OBJECT_DELETE` events so late edits can be compared against them.

### 3.11 `TASK`

Creates or replaces a task: a short text and, optionally, who should do it and where.

| Size  | Field      | Notes                                                                                      |
| ----- | ---------- | ------------------------------------------------------------------------------------------ |
| 8     | `task`     | Task reference, see below                                                                  |
| 1     | `status`   | `0` open, `1` in progress, `2` done, `3` cancelled; reserved values read as open           |
| 4     | `assignee` | Node ID of the member who should do it, or ID of the team (§3.15); `00000000` means anyone |
| 1     | `place`    | `0` none, `1` point, `2` object; reserved values read as none                              |
| 8     | `where`    | See below; zeros when `place` is none                                                      |
| 1–129 | `text`     | text-rest                                                                                  |

`where` holds, for a point, its `lat` and `lon` (4 bytes each, as coordinates); for an object, the object's reference (§3.10). A task at an object follows it: it is wherever the object is now, and has no place once the object is deleted. A route (a polyline with the Route style, §4.2) as the place of a task is the way to go.

Tasks follow the same rules as objects (§3.10), with `task` in place of `object`:

- To create a task, an event uses its own `(origin, seq)` as `task`.
- To change it — its status, assignee, place or text — any member sends a new `TASK` with the same `task` and every field filled in.
- The current state of a task is given by the `TASK` with the greatest `(time, origin, seq)` among those with that `task`.
- A cancelled task no longer shows as pending, but it is not deleted: a newer `TASK` reopens it.

A member whose node ID happens to be `00000000` cannot be assigned tasks; with 2³² possible IDs this is accepted.

### 3.12 `ROLL_CALL`

Asks every member of the group to say they are well.

| Size  | Field  | Notes                                                                                  |
| ----- | ------ | -------------------------------------------------------------------------------------- |
| 0–151 | `text` | text-rest; empty for the usual question, which each receiver words in its own language |

- Each member answers once, with an `ACK` referencing the `ROLL_CALL`. A member who needs help sends an `SOS` instead.
- The newest `ROLL_CALL` by `(time, origin, seq)` is the current one; older ones are history.
- Over LoRa, answers wait the same random 2–30 seconds as other acknowledgements but, unlike them (§3.8), are never dropped for having heard another member's answer: each member answers for themselves.

### 3.13 `SWEEP`

One strip of a sweep: a search area walked in parallel lanes, the lanes split among teams. Each strip is a map object (§3.10), so it can be handed out as a task's place (§3.11) and deleted when the sweep is called off. Only the recipe travels; every device works out the same lanes from it and from the area.

| Size | Field     | Notes                                                                     |
| ---- | --------- | ------------------------------------------------------------------------- |
| 8    | `object`  | Object reference, see §3.10                                               |
| 8    | `area`    | Object reference of the polygon swept (a `SHAPE` of kind polygon)         |
| 2    | `spacing` | `u16`, metres between lanes, at least 1                                   |
| 2    | `heading` | `u16`, direction of the lanes in degrees clockwise from true north, 0–179 |
| 1    | `strip`   | `u8`, which strip this is, from 0                                         |
| 1    | `strips`  | `u8`, how many strips the sweep has; greater than `strip`                 |

Encoded size: 36 bytes. An event whose `spacing`, `heading` or `strip` is out of range is discarded. The strips of one sweep share `area`, `spacing`, `heading` and `strips`.

**Lanes.** The strip follows the area's current geometry; while the area is not a polygon, or is deleted, the strip has no lanes. Receivers SHOULD draw them as follows, so that every device shows the same:

1. Place each corner of the area on a plane: `east = (lon − lon₀) · R · cos(lat₀)` and `north = (lat − lat₀) · R`, in metres, with the area's first point as `(lat₀, lon₀)`, angles in radians and R = 6 371 000 m.
2. With h the heading, measure each corner along the lanes, `v = east · sin h + north · cos h`, and across them, `u = east · cos h − north · sin h`.
3. Lanes run at `u = u_min + spacing · (i + ½)` for i = 0, 1, 2… while below `u_max`; if there is none, one runs at `(u_min + u_max) / 2`. If `u_max − u_min` is more than 1000 · `spacing`, there are no lanes at all: no device works out more than 1000.
4. Each lane crosses the edges whose ends have `u` on either side of it (one end's `u` at most the lane's and the other's above it). Sorted by `v`, the crossings pair up: the lane is inside the area from the first to the second, from the third to the fourth, and so on.
5. Of L lanes and `strips` strips, strip k holds lanes ⌊k · L / strips⌋ to ⌊(k + 1) · L / strips⌋ − 1.
6. A strip is walked lane after lane in increasing `u`: its first lane in increasing `v`, the next in decreasing `v`, and so on.

### 3.14 `MEMBER_STATE`

What the team needs to know about a member besides where they are: what they do, whether they can be counted on now, how much battery their device has left and what they carry. A member sends it when any of these changes; the newest by `(time, origin, seq)` of each origin replaces the others.

| Size | Field       | Notes                                                                                                                                                                                                                                                                                                                                              |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `profile`   | `0` unspecified, `1` police, `2` civil protection, `3` firefighters, `4` medical, `5` rescue, `6` volunteer, `7` military, `8` other; reserved values read as unspecified                                                                                                                                                                          |
| 1    | `status`    | `0` active, `1` resting, `2` off duty; reserved values read as active                                                                                                                                                                                                                                                                              |
| 1    | `battery`   | Percent, 0–100; `255` unknown; other values read as unknown                                                                                                                                                                                                                                                                                        |
| 4    | `equipment` | `u32` of bits, from the lowest: first-aid kit, defibrillator, stretcher, food, water, blankets, rope, lighting, radio, extinguisher, vehicle, drone, weapon, LoRa radio linked, 4×4 vehicle, boat, search dog, thermal camera, satellite phone, generator, power bank, chainsaw, water pump, hand tools, oxygen, megaphone; other bits are ignored |

Encoded size: 21 bytes. The LoRa bit says that a radio is linked to the member's app now, so that it keeps in touch over LoRa without coverage (§7); the app sets it as the radio links and clears it as it goes, and the member never sets it by hand. Over LoRa, a device SHOULD NOT send it for every percent of battery: steps of 10 % are enough.

### 3.15 `TEAM`

Creates or replaces a team: a name, a colour and the members in it. Teams are how a group is split for the work; a task (§3.11) or a strip of a sweep (§3.13) can be for a whole team.

| Size  | Field       | Notes                                                                                       |
| ----- | ----------- | ------------------------------------------------------------------------------------------- |
| 4     | `team`      | Team ID, see below                                                                          |
| 1     | `colour`    | `0` blue, `1` orange, `2` teal, `3` red, `4` green, `5` black; reserved values read as blue |
| 1     | `dissolved` | `0` no, `1` yes; a dissolved team is no longer shown; other values read as no               |
| 1     | `count`     | `u8`, number of members                                                                     |
| 4 × n | `members`   | Their node IDs                                                                              |
| 1–32  | `name`      | text-rest                                                                                   |

- A team ID is 4 bytes in the space of node IDs, so `TASK.assignee` can name a team. The member who creates a team picks it at random, never `00000000` and never the node ID of a member the group knows.
- To change a team, any member sends a new `TEAM` with the same `team` and every field filled in; the newest by `(time, origin, seq)` is the team's current state.
- A member is in one team at a time. A device that moves a member sends both teams; should two teams list the same member, the newest of them counts.
- With the longest name, a team holds up to 28 members.

### 3.16 `REPORT`

A situation report from the scene, in the order emergency services use (METHANE): where, what happened, the dangers, the way in, the casualties and the help needed. Reports are kept like chat lines, in `(time, origin, seq)` order; a newer report from the same scene does not replace an older one.

| Size  | Field        | Notes                                                                                                                                                                   |
| ----- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `kind`       | `0` situation; reserved values read as situation                                                                                                                        |
| 1 + 8 | `place`      | As `TASK.place` (§3.11): none, a point or an object                                                                                                                     |
| 1     | `incident`   | `0` other, `1` fire, `2` flood, `3` traffic accident, `4` collapse, `5` missing person, `6` rescue, `7` hazardous materials, `8` medical; reserved values read as other |
| 2     | `hazards`    | `u16` of bits, from the lowest: fire, smoke, gas, electricity, water, collapse, chemicals, traffic, violence; other bits are ignored                                    |
| 1     | `access`     | `0` unknown, `1` clear, `2` difficult, `3` blocked; reserved values read as unknown                                                                                     |
| 4     | `casualties` | One `u8` each for the triage categories red, yellow, green and black: how many, 0–254; `255` unknown                                                                    |
| 2     | `resources`  | `u16` of bits, from the lowest: ambulance, firefighters, police, rescue, helicopter, machinery, more people, supplies, shelter; other bits are ignored                  |
| 0–131 | `note`       | text-rest                                                                                                                                                               |

### 3.17 `CHECK_IN_TIMER`

Turns on, changes or turns off the group's safety check-in: a device asks its member whether they are well after they have gone this long without moving or touching it.

| Size | Field     | Notes                   |
| ---- | --------- | ----------------------- |
| 2    | `minutes` | `u16`; `0` turns it off |

- The newest `CHECK_IN_TIMER` by `(time, origin, seq)` is the one in force.
- A device SHOULD ask only while its member's status is active (§3.14), and only for time the app was in use on screen.
- A member who does not answer within 2 minutes is presumed in trouble: their device SHOULD send an `SOS` (§3.8) of kind general, from where it last was. Answering sends nothing.

## 4. Symbol and style codes

### 4.1 Symbols (`MARKER.symbol`)

| Range             | Use                                      |
| ----------------- | ---------------------------------------- |
| `0x0000`–`0x0FFF` | Civil symbol set, below                  |
| `0x1000`–`0x7FFF` | Reserved for NATO APP-6 mapping (future) |
| `0x8000`–`0xFFFF` | Reserved                                 |

| Code     | Meaning                   |
| -------- | ------------------------- |
| `0x0000` | Generic point             |
| `0x0001` | Injured person            |
| `0x0002` | Missing person, last seen |
| `0x0003` | Fire                      |
| `0x0004` | Flood                     |
| `0x0005` | Hazard                    |
| `0x0006` | Blocked road              |
| `0x0007` | Shelter                   |
| `0x0008` | Meeting point             |
| `0x0009` | Medical post              |
| `0x000A` | Water point               |
| `0x000B` | Helicopter landing zone   |
| `0x000C` | Command post              |

Receivers MUST display unknown codes as a generic point.

### 4.2 Styles (`SHAPE.style`)

| Code     | Meaning               |
| -------- | --------------------- |
| `0x0000` | Neutral               |
| `0x0001` | Danger area           |
| `0x0002` | Search area, assigned |
| `0x0003` | Search area, cleared  |
| `0x0004` | Safe area             |
| `0x0005` | Route                 |
| `0x0006` | Operation area        |

Receivers MUST display unknown codes as neutral.

An operation area is the area the group works in. Receivers MAY offer to download its map for use without a connection.

## 5. Group cryptography

A group is a 16-byte random **group secret** `S`, generated with a cryptographically secure random number generator. From it:

| Value                 | Derivation                                                      | Size     |
| --------------------- | --------------------------------------------------------------- | -------- |
| Group ID              | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "group-id")`    | 16 bytes |
| Content key           | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "content-key")` | 32 bytes |
| Event-key MAC key     | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "event-key")`   | 32 bytes |
| Nonce key             | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "nonce-key")`   | 32 bytes |
| Event key of an event | `HMAC-SHA256(eventKeyMacKey, origin ‖ seq as u32)`, truncated   | 16 bytes |

Strings are ASCII. The group ID is public; the others are secret.

### 5.1 Envelope

Events sent over the internet are sealed in an envelope:

```
envelope = nonce (12 bytes) ‖ AES-256-GCM(contentKey, nonce, event, aad = groupId)
nonce    = HMAC-SHA256(nonceKey, event), truncated to 12 bytes
```

The ciphertext includes the 16-byte GCM tag, so an envelope is at most 12 + 165 + 16 = 193 bytes. A receiver that fails to open an envelope MUST discard it silently.

The nonce is derived from the event, so the same event always gives the same envelope: a retry, a re-push or a bridge forwarding an event the server already has adds nothing to the server's store (§8). Different events get unrelated nonces, as random ones would be, so a group SHOULD stay well below 2³² distinct events under one secret (the AES-GCM bound for random nonces). An envelope reveals only that it carries the same event as another, which its event key (§5) already does. Receivers do not check how the nonce was made: envelopes sealed by earlier versions, with random nonces, open the same way ([ADR-0067](decisions/0067-envelope-nonce-from-the-event.md)). Key rotation is future work.

## 6. Invitations

An invitation is a URL:

```
{app-base-url}join#{token}
```

`{app-base-url}` is the URL the web app is served from, ending in `/`: `https://app.example/` or, for an app served from a sub-path, `https://tesel.eu/app/`.

In this section a **secure URL** is an `https:` URL, or an `http:` URL whose host is `localhost`, `127.0.0.1` or `[::1]` (development only; these are the origins browsers treat as secure contexts).

The token sits in the fragment so it is never sent to any server. It is the base64url encoding of:

| Size | Field     | Notes                                                                                   |
| ---- | --------- | --------------------------------------------------------------------------------------- |
| 1    | `version` | `1`                                                                                     |
| 1    | `role`    | Role granted: `0` member, `1` coordinator                                               |
| 16   | `secret`  | Group secret                                                                            |
| 4    | `issuer`  | Node ID of whoever created the invitation                                               |
| 1+n  | `name`    | text-u8, group name, 1–32 bytes                                                         |
| 1+n  | `server`  | text-u8, server base URL, 0–200 bytes; empty if none. MUST be a secure URL when present |

Decoders MUST accept only secure URLs with no query whose last path segment is exactly `join` (the path is `/join` or ends in `/join`). Servers and static hosts MUST answer that path with the web app (see [ADR-0012](decisions/0012-invitation-links-under-a-base-path.md)). A reserved `role` value grants member. Anyone holding an invitation can join the group. Interfaces MUST make clear that sharing an invitation shares the group.

## 7. Transport: LoRa radios

A device reaches the LoRa mesh through a radio of one of two kinds, by the firmware it runs. Both carry the same event bytes; a radio of one kind does not hear one of the other, since their packets differ on the air.

### 7.1 MeshCore

- The group secret is written to a channel slot of the companion radio with `CMD_SET_CHANNEL`. The channel name is the group name, truncated to 31 bytes at a code-point boundary. Implementations MUST reuse a slot that already holds the secret, otherwise take the first empty slot (empty name, all-zero secret) other than slot 0, and MUST NOT overwrite any other channel.
- Each event is sent with `CMD_SEND_CHANNEL_DATA` on that channel, flood routing (`path_len = 0xFF`), `data_type = 0xFF4D`, payload = the event bytes. The radio encrypts it with the channel key.
- Inbound `RESP_CODE_CHANNEL_DATA_RECV` frames on that channel with `data_type = 0xFF4D` are decoded as events. Other `data_type` values are ignored.
- The radio encrypts channel traffic with AES-128 in ECB mode and authenticates it with a 2-byte truncated HMAC. That protects against casual listening, not against a determined attacker; see [ADR-0010](decisions/0010-lora-link-security.md).
- `0xFF4D` is in MeshCore's development range. A permanent value will be registered before the first public release; implementations SHOULD accept both during the transition.

### 7.2 Meshtastic

- The group secret is the key (PSK) of one of the radio's secondary channels, set with an `AdminMessage.set_channel` sent to the radio's own node number on `ADMIN_APP`. The channel name is the group name, truncated to 11 bytes at a code-point boundary. Implementations MUST reuse a secondary channel whose 16-byte key is the secret, otherwise take the first disabled channel, and MUST NOT change the primary channel or any other channel. With all eight in use, the group cannot use the radio.
- Each event is sent as a `MeshPacket` to the broadcast address (`0xFFFFFFFF`) on that channel's index, with the radio's configured hop limit (3 if it reports none) and no acknowledgement requested. Its `Data` has `portnum = 256` (`PRIVATE_APP`) and `payload` = the event bytes. The radio encrypts it with the channel key.
- Inbound packets with `portnum = 256`, decoded by the radio on a secondary channel whose key is 16 bytes, are decoded as events of the group with that secret. Other ports are not Tesel events.
- The radio encrypts with AES-128 in CTR mode keyed with the channel key, and adds no message authentication: anyone can flip bits of a packet unnoticed, and only Tesel's strict decoder stands between a forged packet and the log. That protects against casual listening, not against a determined attacker; see [ADR-0098](decisions/0098-meshtastic-radios.md).
- Meshtastic and MeshCore radios do not hear each other. A group whose members carry both kinds reaches all of them only through members who bridge to the internet (ARCHITECTURE.md §4.3).

## 8. Transport: internet

Clients connect to `v1/ws` relative to the server base URL, with the scheme changed to `wss:` (`ws:` for a loopback development server): `https://relay.example/` becomes `wss://relay.example/v1/ws`. Frames are JSON text messages; binary values are base64url strings. One connection carries one group.

**Client to server**

| Message                                             | Meaning                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `{"t": "join", "group": GROUP_ID, "after": CURSOR}` | Subscribe to a group and receive every envelope with a cursor greater than `after` (`0` for everything) |
| `{"t": "push", "key": EVENT_KEY, "env": ENVELOPE}`  | Store and relay an envelope                                                                             |
| `{"t": "ping"}`                                     | Ask whether the connection is alive, joined or not; the server answers `pong`                           |

**Server to client**

| Message                                                        | Meaning                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `{"t": "env", "cursor": N, "key": EVENT_KEY, "env": ENVELOPE}` | A stored envelope; `cursor` increases per group                                                                            |
| `{"t": "synced", "cursor": N, "store": STORE_ID}`              | The backlog after `after` has been sent; live envelopes follow. `store` is the server's store identity                     |
| `{"t": "stored", "key": EVENT_KEY}`                            | The pushed envelope is stored, now or already before                                                                       |
| `{"t": "pong"}`                                                | The answer to `ping`                                                                                                       |
| `{"t": "error", "code": CODE, "key": EVENT_KEY}`               | `bad-request`, `too-large`, `rate-limited`, `not-joined` or `unavailable`; `key` is present when the error concerns a push |

- If `after` is greater than the group's last cursor, for instance because the server lost data or deleted a quiet group's envelopes, the server sends every envelope it has, then `synced` with its last cursor. Clients always adopt the cursor of `synced`.
- The **store identity** is 16 random bytes, base64url, created with the server's database and kept in it; cursors are only comparable within one identity. A client keeps the identity with its cursor. When `synced` carries another identity than the one it saved, the server lost its data or was restored from a backup ([ADR-0046](decisions/0046-store-identity.md)): the client saves the new identity, sets its cursor to `0`, joins again, and pushes its own events again.
- The server MUST store at most one envelope per `(group, key, SHA-256 of the envelope)`. A push identical to a stored envelope is answered with `stored` and not relayed again; a different envelope under a known key is stored and relayed like any other, since the server cannot tell which one is genuine ([ADR-0045](decisions/0045-server-keeps-every-distinct-envelope.md)). Receivers MUST discard an envelope whose event, once opened, has another event key (§5) than the message's `key`. Clients keep an envelope in their outbox until they receive `stored` for its key.
- The server MUST reject envelopes larger than 193 bytes with `too-large`, and envelopes smaller than 42 bytes (nonce, event header and tag) with `bad-request`. It answers `unavailable` when it cannot store a push now, for instance with its disk nearly full; the client keeps the envelope and pushes it again later.
- The server SHOULD rate-limit pushes per connection, per group and in all, and MAY delete envelopes older than a configured retention period.
- The server MAY limit connections in all and per client address, refusing the WebSocket upgrade with HTTP `503`; it MAY limit the groups it does not know that one address joins, answering such a `join` with `rate-limited` and closing the connection. It closes connections that have not joined a group within a few seconds.
- A client SHOULD send `ping` after some 25 seconds without a message from the server and SHOULD give the connection up if nothing comes back within some 20 seconds more: connections can die without closing.
- The server never receives the group secret, the content key or plaintext events.

### 8.1 Server information

`GET healthz`, relative to the server base URL, answers a JSON object:

```json
{ "status": "ok", "protocolVersion": 1, "time": 1793000000 }
```

| Field             | Meaning                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `protocolVersion` | The version of this protocol the server speaks (§9)                                                                   |
| `time`            | The server's clock, in seconds since the epoch; clients compare it with theirs to notice a device clock that is wrong |

Clients ignore unknown fields. A server whose storage does not answer responds `503` with `{"status": "unavailable"}`. The response allows any origin (`Access-Control-Allow-Origin: *`), since apps served elsewhere read it. Two server URLs are the same server when they are equal after adding a missing trailing `/` to the path.

### 8.2 Weather warnings

A server MAY publish the official weather warnings of its region, which it gathers itself. They are public information, not group data, and clients read them without joining anything. `GET v1/weather-warnings`, relative to the server base URL, answers a GeoJSON `FeatureCollection` with one feature per warning region, and these members besides:

| Member    | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `tesel`   | `"weather-warnings"`                                       |
| `version` | `1`                                                        |
| `updated` | Seconds since the epoch when the server last gathered them |
| `source`  | Who issues the warnings, to be credited                    |

Each feature has a `Polygon` or `MultiPolygon` geometry, coordinates rounded to 3 decimals, and these properties:

| Property   | Meaning                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`     | The region's code (MeteoAlarm `EMMA_ID`)                                                                                                                                                                      |
| `name`     | The region's name                                                                                                                                                                                             |
| `level`    | The highest level among its warnings                                                                                                                                                                          |
| `warnings` | Its warnings, each `{ level, onset, expires, text }`: level `2` yellow, `3` orange, `4` red; onset and expiry in seconds since the epoch; `text` by language code (`es`, `en`), each `{ event, description }` |

Only warnings that have not expired are listed, at the time of the request. The response allows any origin (`Access-Control-Allow-Origin: *`). A server that does not gather warnings answers `404`; one that has not gathered them yet, or whose last gathering is older than it allows, answers `503`.

## 9. Versioning

This document describes protocol version 1. Adding event types, symbol codes or style codes does not change the version. Version 1 is frozen with the first release, v0.1.0; until then it still changed in place: the `env` message gained `key`, and §8.1 was added; command posts, servers that replicated another (§8.2 and §8.3 then), were added and later removed ([ADR-0058](decisions/0058-no-command-posts.md)); §3.1 gained the rules on an author's times and on damaged events, and §3.8 the SOS without a place; envelope nonces became derived from the event (§5.1); `synced` gained the store identity, servers keep every distinct envelope, the error `unavailable` was added, and `healthz` gained `time`, and `ping` and `pong` were added (§8). Changing any existing layout, derivation or transport rule requires version 2, a new ADR and a migration plan.

## 10. Log files

A device can save a group's log to a file and another device of the group can read it back: a backup, or a way to carry events between devices that never shared a link (a phone that worked by radio only, handing its log to the coordinator's on a memory stick). The file is UTF-8 JSON:

```json
{
  "tesel": "log",
  "version": 1,
  "group": "<group ID, base64url>",
  "envelopes": ["<envelope, base64url>", "..."]
}
```

- `group` is the group ID (§5); a reader MUST refuse a file of another group.
- Each envelope seals one event exactly as for the internet transport (§5.1), so the file reveals no more than a relay sees: the number and size of events. Envelopes are in no particular order and may repeat events the reader has; it MUST discard those that do not open and keep the rest as if received from a relay. A reader with a server SHOULD pass the new ones on to it, as a bridge does with events heard on the radio, so the group's server ends up with them too.
- Base64url is without padding, as in invitations (§6).
- `version` is this file layout's version, separate from the protocol version. A reader MUST refuse versions it does not know.
