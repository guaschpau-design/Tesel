# @tesel/meshcore

Connects Tesel to a MeshCore companion radio (firmware v1.18 or later, Companion BLE build) and exchanges frames (events Tesel has sealed, which this package neither seals nor opens) as channel data datagrams, as specified in [`docs/protocol.md`](../../docs/protocol.md) §7.1 and decided in [ADR-0006](../../docs/decisions/0006-meshcore-first-channel-datagrams.md).

It implements the `RadioLink` contract of [`@tesel/radio`](../radio), on that package's connection keeper, so the library underneath can be replaced without touching anything else.

| File                | Responsibility                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service.ts`        | The radio's Bluetooth service: the package's light entry, `@tesel/meshcore/service`, used by the picker ([ADR-0098](../../docs/decisions/0098-meshtastic-radios.md)) |
| `meshcore-radio.ts` | `RadioLink` over a MeshCore companion: channel slots, sending datagrams, draining waiting messages                                                                   |
| `channel-slot.ts`   | Which channel slot holds the group secret                                                                                                                            |
| `data-type.ts`      | The `data_type` of the datagrams Tesel sends, and those it accepts                                                                                                   |
| `air.ts`            | Time on air of a frame on MeshCore's EU narrow preset                                                                                                                |
| `companion.ts`      | The typed subset of the companion connection used here                                                                                                               |
| `web-ble.ts`        | Opening a radio over Web Bluetooth with the MIT-licensed `@liamcottle/meshcore.js`                                                                                   |

While Tesel is connected it reads every message the radio holds. Text messages of other MeshCore apps are passed to `onText` so the app can keep and show them.
