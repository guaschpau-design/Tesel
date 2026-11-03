# @tesel/server

Stores and relays encrypted envelopes for groups ([`docs/protocol.md`](../../docs/protocol.md) §8), and serves the landing page and the web app from the same origin ([ADR-0017](../../docs/decisions/0017-server-serves-site-and-app.md)). It never sees plaintext.

Runs TypeScript directly with Node's built-in type stripping (Node 22.18 or later; the image runs Node 24); there is no build step.

A setting set to nothing counts as left out and takes its default. A list that should be empty says `none` (`off` for the weather). On a VPS, the settings go in `/opt/tesel/.env`, from which `deploy/vps/compose.yaml` passes the server those of the table below but `TESEL_HOST`, `TESEL_PORT`, `TESEL_DB` and `TESEL_WEB_ROOT`, which the image sets; it trusts Caddy as the proxy.

| Variable                           | Default         | Meaning                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TESEL_HOST`                       | `0.0.0.0`       | Interface to listen on                                                                                                                                                                                                                                     |
| `TESEL_PORT`                       | `8080`          | TCP port                                                                                                                                                                                                                                                   |
| `TESEL_DB`                         | `data/tesel.db` | SQLite database file, or `:memory:`                                                                                                                                                                                                                        |
| `TESEL_RETENTION_DAYS`             | `30`            | Envelopes older than this are deleted                                                                                                                                                                                                                      |
| `TESEL_WEB_ROOT`                   | none            | Folder with the landing page and the built app under `app/`; the image sets it                                                                                                                                                                             |
| `TESEL_WEATHER`                    | `ES,PT`         | Countries whose official weather warnings it gathers and serves (§8.2), or `off`                                                                                                                                                                           |
| `TESEL_WEATHER_MAX_AGE_MINUTES`    | `70`            | Warnings gathered longer ago than this are no longer served: gathering failed for an hour past its 10-minute interval                                                                                                                                      |
| `TESEL_MAX_CONNECTIONS`            | `10000`         | Open WebSocket connections at most; more are refused with `503`. At most `TESEL_UNREAD_MB` × 128, so each may leave 8 KB unread                                                                                                                            |
| `TESEL_MAX_CONNECTIONS_PER_IP`     | `256`           | Open connections at most from one client address (phones behind a carrier's NAT share one)                                                                                                                                                                 |
| `TESEL_UNREAD_MB`                  | `96`            | What all clients together may leave unread, shared out among the connections (at most 1 MB each); sized with `TESEL_MAX_CONNECTIONS` to the VPS's 512 MB container                                                                                         |
| `TESEL_NEW_GROUPS_PER_IP_PER_HOUR` | `120`           | Groups the server does not know that one address may join in an hour                                                                                                                                                                                       |
| `TESEL_PUSHES_PER_SECOND`          | `500`           | Pushes per second to the whole server, with ten seconds' worth at once; each connection gets 3 and each group 30. While it is contended, an address or a group that pushed more than an equal share waits, and groups in their first day take at most half |
| `TESEL_PUSHES_PER_IP_PER_SECOND`   | `100`           | Pushes per second from one client address, across its connections and groups, with ten seconds' worth at once                                                                                                                                              |
| `TESEL_MB_PER_IP_PER_DAY`          | `512`           | Megabytes of database one client address may fill in a day; an envelope counts with the 250 bytes stored beside it                                                                                                                                         |
| `TESEL_MB_PER_GROUP_FIRST_DAY`     | `256`           | Megabytes of database a group may fill in its first day, counted from the oldest envelope the server has of it                                                                                                                                             |
| `TESEL_MIN_FREE_DISK_MB`           | `500`           | Pushes are answered `unavailable` while the database's disk has no more free                                                                                                                                                                               |
| `TESEL_TRUSTED_PROXIES`            | `loopback`      | Reverse proxies whose `X-Forwarded-For` names the client: addresses, ranges, or `loopback`, `linklocal`, `uniquelocal`; `none` for none. Name only the proxy: any client it trusts can claim any address                                                   |

The server logs errors to standard error, never with group IDs, client addresses or secrets. Connections that do not join a group within 10 seconds are closed, as are those that send more than 10 messages a second (100 at once) or keep sending messages the server refuses; an address joins at most 2 groups a second once it has joined 256 at once (ADR-0107). The database records its schema version and is upgraded in place on start. A push is answered `stored` only once it is on the disk.

The groups that take the most room are listed, and one group's envelopes deleted, with `node src/store-admin.ts groups` and `node src/store-admin.ts purge GROUP`, beside the running server; on a VPS, `deploy/vps/database.sh` runs them.

Restoring the database from a backup: give it a new store identity before starting the server, so that clients do not trust their cursors for the old one ([ADR-0046](../../docs/decisions/0046-store-identity.md)). On a VPS, `deploy/vps/database.sh` does it ([`deploy/README.md`](../../deploy/README.md)); elsewhere:

```sh
node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('data/tesel.db').exec('UPDATE store_info SET id = randomblob(16)')"
```

| File                    | Job                                                             |
| ----------------------- | --------------------------------------------------------------- |
| `src/main.ts`           | Reads the configuration, starts everything and stops it cleanly |
| `src/config.ts`         | The settings, read from the environment                         |
| `src/app.ts`            | HTTP routes: `healthz`, the relay, weather, the web files       |
| `src/relay.ts`          | Joins, pushes and fan-out                                       |
| `src/backlog.ts`        | A joining client's backlog, page by page and in turns           |
| `src/relay-limits.ts`   | Limits on connections, joins, new groups and messages           |
| `src/push-limits.ts`    | Limits on pushes and on what is stored                          |
| `src/fair-share.ts`     | The server's pushes, shared out fairly                          |
| `src/recent-rates.ts`   | How fast each address or group has pushed lately                |
| `src/unread-bytes.ts`   | The cap on what all clients leave unread                        |
| `src/keyed-buckets.ts`  | Rate limits kept per group or per address                       |
| `src/disk-space.ts`     | Free space on the database's disk                               |
| `src/heartbeat.ts`      | Pings that close connections whose peer vanished                |
| `src/envelope-store.ts` | SQLite storage of envelopes, cursors and the store identity     |
| `src/store-schema.ts`   | The database schema and its upgrades                            |
| `src/store-admin.ts`    | The operator's commands: the largest groups, and purging one    |
| `src/ws-text.ts`        | The relay's frame size limit and frame text                     |
| `src/web.ts`            | The landing page at `/` and the app under `/app/`               |
| `src/weather/`          | Official weather warnings from MeteoAlarm, served as §8.2       |
