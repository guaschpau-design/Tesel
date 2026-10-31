# Architecture decision records

Each file records one decision: the context, what we chose and what follows from it. Records are never edited after acceptance except for their status line, which names the later records that amend, settle or supersede them; a changed decision gets a new record. The status column below mirrors each status line.

Template: copy [`template.md`](template.md), use the next number, keep it under a page.

| #                                                    | Decision                                                                                    | Status                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [0001](0001-record-decisions-and-language.md)        | Record decisions as ADRs; English for code and technical docs                               | Accepted                                    |
| [0002](0002-pwa-only-client.md)                      | A progressive web app is the only client in v0.1                                            | Superseded after v0.1 by 0016               |
| [0003](0003-event-log-last-writer-wins.md)           | Event log with last-writer-wins instead of a CRDT library                                   | Accepted, amended by 0044, 0055             |
| [0004](0004-one-binary-format-every-transport.md)    | One binary event format for every transport                                                 | Accepted                                    |
| [0005](0005-group-secret-trust-boundary.md)          | The group secret is the trust boundary; the server is zero-knowledge                        | Accepted, amended by 0052                   |
| [0006](0006-meshcore-first-channel-datagrams.md)     | MeshCore first, through channel data datagrams                                              | Accepted                                    |
| [0007](0007-self-hosted-vector-maps.md)              | Self-hosted vector maps for offline use                                                     | Accepted, partly superseded by 0011         |
| [0008](0008-one-server-vps-and-command-post.md)      | One server program for the VPS and the local command post                                   | Superseded by 0058                          |
| [0009](0009-toolchain.md)                            | Toolchain: TypeScript, pnpm workspace, Svelte, Vitest                                       | Accepted                                    |
| [0010](0010-lora-link-security.md)                   | Rely on MeshCore channel encryption for LoRa in v0.1, knowing its limits                    | Accepted                                    |
| [0011](0011-client-side-area-download.md)            | Download offline areas tile by tile in the browser                                          | Accepted, amended by 0056                   |
| [0012](0012-invitation-links-under-a-base-path.md)   | Invitation links work under a base path                                                     | Accepted, amended by 0017                   |
| [0013](0013-self-updating-vps.md)                    | A self-updating VPS behind Caddy, installed by one script                                   | Accepted, partly superseded by 0049         |
| [0014](0014-name-teselia.md)                         | The project is called Teselia                                                               | Superseded by 0019                          |
| [0015](0015-lora-airtime-policy.md)                  | LoRa airtime policy                                                                         | Accepted, amended by 0043                   |
| [0016](0016-web-app-and-native-shells.md)            | The web app first, and Android and iOS apps built from the same code                        | Accepted                                    |
| [0017](0017-server-serves-site-and-app.md)           | The server serves the landing page and the web app                                          | Accepted                                    |
| [0018](0018-command-post.md)                         | A command post is a replicating server on its own Wi-Fi, found by name                      | Superseded by 0058                          |
| [0019](0019-name-tesel.md)                           | The project is called Tesel                                                                 | Accepted                                    |
| [0020](0020-colour-and-symbols.md)                   | Signal lime, colours defined once, and symbols of our own                                   | Accepted                                    |
| [0021](0021-coordinate-formats.md)                   | Write coordinates in four formats, converted by our own code                                | Accepted                                    |
| [0022](0022-log-files.md)                            | Carry a group's log in files of sealed envelopes                                            | Accepted, amended by 0055                   |
| [0023](0023-ign-base-maps.md)                        | Topographic and aerial base maps from Spain's IGN, read by the browser                      | Accepted, amended by 0034, 0037, 0041       |
| [0024](0024-terrain-tiles-for-relief.md)             | Relief from the open Terrain Tiles, read by the browser                                     | Superseded by 0037                          |
| [0025](0025-tasks.md)                                | Tasks as one event type, changed by anyone, last writer wins                                | Accepted, amended by [0059](0059-routes.md) |
| [0026](0026-one-kind-of-alert.md)                    | The app sends one kind of alert                                                             | Superseded by 0070                          |
| [0027](0027-public-services-from-the-base-map.md)    | Public services from the base map                                                           | Accepted                                    |
| [0028](0028-roll-call.md)                            | Roll call: one event, answered with an ACK by each member                                   | Superseded by 0070                          |
| [0029](0029-operation-area.md)                       | The operation area: an area style that offers its map                                       | Accepted                                    |
| [0030](0030-weather-warnings.md)                     | Official weather warnings, gathered by the server from MeteoAlarm                           | Accepted, amended by 0038                   |
| [0031](0031-practice-mode.md)                        | Practice mode: a simulated group played on the device                                       | Accepted, amended by 0066, 0072             |
| [0032](0032-radio-line-of-sight.md)                  | Radio line of sight from the terrain, sure only when it says no                             | Superseded by 0042, amended before by 0037  |
| [0033](0033-danger-area-warning.md)                  | Warning on entering a danger area, worked out on each device                                | Accepted                                    |
| [0034](0034-vector-topographic-map.md)               | Topographic map from vector data, relief shaded from IGN's terrain model                    | Accepted, amended by 0037                   |
| [0035](0035-base-maps-by-purpose.md)                 | Give each base map a purpose of its own                                                     | Accepted                                    |
| [0036](0036-cadastre-layer.md)                       | The cadastre's parcels as one picture of the view, online only                              | Accepted, amended by 0037                   |
| [0037](0037-maps-across-borders.md)                  | Maps across Spain, Portugal and southern France                                             | Accepted, amended by 0041                   |
| [0038](0038-official-warnings-look.md)               | Draw official warnings unlike the group's own areas                                         | Accepted                                    |
| [0039](0039-map-credits-and-scale.md)                | Map credits on opening and in the layers panel, scale with the controls                     | Accepted                                    |
| [0040](0040-dictated-messages.md)                    | Dictate chat messages with the browser's speech recognition                                 | Accepted                                    |
| [0041](0041-satellite-mosaic-and-national-photos.md) | One Sentinel-2 mosaic from afar, each country's photographs close up                        | Accepted, amended by 0051                   |
| [0042](0042-remove-radio-line-of-sight.md)           | Remove the radio line of sight                                                              | Accepted                                    |
| [0043](0043-radio-delivery.md)                       | Deliver over the radio until someone has it                                                 | Accepted                                    |
| [0044](0044-clocks-and-damaged-events.md)            | Keep each author's events in order, and say when a clock is wrong                           | Accepted                                    |
| [0045](0045-server-keeps-every-distinct-envelope.md) | The server keeps every distinct envelope pushed under a key                                 | Accepted, amended by 0067                   |
| [0046](0046-store-identity.md)                       | A server's store has an identity, and cursors belong to it                                  | Accepted                                    |
| [0047](0047-alarms-and-notices.md)                   | Raise the alarm, and say what happened                                                      | Accepted, amended by 0070                   |
| [0048](0048-how-the-app-shares-state.md)             | One rule for sharing state in the web app, and panels that carry what they show             | Accepted                                    |
| [0049](0049-signed-images-and-checked-updates.md)    | Run only signed server images, and check every update                                       | Accepted, amended by 0068                   |
| [0050](0050-post-certificates-from-the-server.md)    | Command posts get their certificate from the server                                         | Superseded by 0058                          |
| [0051](0051-satellite-mosaic-licence.md)             | Name the satellite mosaic's licence, and let a build change the mosaic                      | Accepted                                    |
| [0052](0052-authorship-is-not-proven.md)             | Members are trusted: protocol version 1 does not prove who wrote an event                   | Accepted                                    |
| [0053](0053-load-heavy-parts-on-demand.md)           | Load the heavy parts of the app on demand, MapLibre in a file of its own                    | Accepted                                    |
| [0054](0054-frame-the-group-at-start.md)             | Bring the group into view at start, until the user chooses a view                           | Accepted                                    |
| [0055](0055-forget-outlived-positions.md)            | Forget the positions the trails have outlived                                               | Accepted                                    |
| [0056](0056-storage-and-offline-maps.md)             | Keep room for the log, resume downloads, and never show a blank map                         | Accepted                                    |
| [0057](0057-accessible-interface.md)                 | Meet WCAG 2.1 AA in the app's colours, keyboard use and texts                               | Accepted                                    |
| [0058](0058-no-command-posts.md)                     | Drop command posts: one server per group, radios when there is no internet                  | Accepted                                    |
| [0059](0059-routes.md)                               | Routes: drawn or read from a file, followed leg by leg, and a task's place may be an object | Accepted, amended by 0077                   |
| [0060](0060-sweeps.md)                               | Sweeps: parallel lanes over a search area, one strip per team, sent as a recipe             | Accepted                                    |
| [0061](0061-member-state.md)                         | What members tell about themselves: one event, one card                                     | Accepted, amended by 0069, 0071, 0079       |
| [0062](0062-teams.md)                                | Teams: one event per team, and a task for a team is each member's                           | Accepted                                    |
| [0063](0063-situation-reports.md)                    | Situation reports: a fixed form in one radio message, pinned in the chat                    | Accepted, amended by 0065, 0070             |
| [0064](0064-check-in.md)                             | A safety check-in that asks only when it must                                               | Accepted                                    |
| [0065](0065-room-for-what-is-read.md)                | Give the room to what is read; what is used now and then waits in a menu                    | Accepted, amended by 0070                   |
| [0066](0066-practice-situations.md)                  | Practice situations, on foot along the streets, with a guide                                | Accepted, amended by 0070, 0072             |
| [0067](0067-envelope-nonce-from-the-event.md)        | Derive each envelope's nonce from its event                                                 | Accepted                                    |
| [0068](0068-restorable-copies-and-going-back.md)     | Restore copies under a new identity, and go back across a change of schema                  | Accepted                                    |
| [0069](0069-who-keeps-in-touch-without-coverage.md)  | Tell who keeps in touch without coverage                                                    | Accepted, amended by 0071, 0078             |
| [0070](0070-a-simpler-app.md)                        | A simpler app: one place to add, no alerts or roll calls, a way to start                    | Accepted, amended by 0071, 0078, 0081       |
| [0071](0071-panels-read-whole.md)                    | Me and the map layers are read whole, without opening anything                              | Accepted, amended by 0078, 0081             |
| [0072](0072-practice-as-an-exercise.md)              | Practice as an exercise: a world that changes, people with their own lives, and a director  | Accepted                                    |
| [0073](0073-exercise-report.md)                      | The report at the end of an exercise                                                        | Accepted                                    |
| [0074](0074-race-exercise.md)                        | A popular race to keep safe                                                                 | Accepted                                    |
| [0075](0075-mountain-exercise.md)                    | A mountain route, played where the map is                                                   | Accepted                                    |
| [0076](0076-practice-coverage-loss.md)               | Losing coverage in a practice                                                               | Accepted                                    |
| [0077](0077-coordinates-and-zone-files.md)           | Points by their coordinates, and zones read from a file                                     | Accepted                                    |
| [0078](0078-one-look-and-straight-to-the-point.md)   | One look, and straight to the point                                                         | Accepted                                    |
| [0079](0079-more-equipment-in-groups.md)             | More equipment, offered in groups                                                           | Accepted                                    |
| [0080](0080-told-without-looking.md)                 | Told without having to look                                                                 | Accepted                                    |
| [0081](0081-found-in-a-tap-or-two.md)                | Found in a tap or two                                                                       | Accepted                                    |
