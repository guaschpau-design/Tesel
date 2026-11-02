# @tesel/radio

The contract between Tesel and a LoRa radio, whatever firmware it runs, and what every kind of radio shares ([ADR-0098](../../docs/decisions/0098-meshtastic-radios.md)). The app depends only on `RadioLink`; each kind of radio implements it in its own package: [`@tesel/meshcore`](../meshcore) and [`@tesel/meshtastic`](../meshtastic). The package is light, so the app loads it at start and a kind's package only when a radio of that kind is picked ([ADR-0053](../../docs/decisions/0053-load-heavy-parts-on-demand.md)).

| File                   | Responsibility                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `radio-link.ts`        | The contract: states, the errors a link rejects with, what is received and sent, and whether the browser can reach a radio                                                         |
| `connection-keeper.ts` | Keeping a link's connection: one command at a time with a timeout, a radio that misses one dropped, a lost link connected again by itself                                          |
| `web-ble.ts`           | Web Bluetooth: the API's types, picking a radio of any kind, pairing by reading a protected characteristic ([ADR-0090](../../docs/decisions/0090-pairing-a-radio-from-the-app.md)) |
| `time-limit.ts`        | A time limit on whatever a radio is asked                                                                                                                                          |
| `airtime.ts`           | LoRa time on air of a packet (Semtech's formula), for each kind's `airtimeMs`                                                                                                      |
| `channel-name.ts`      | The group name cut to what a radio stores as a channel name                                                                                                                        |
