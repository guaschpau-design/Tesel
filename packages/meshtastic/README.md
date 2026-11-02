# @tesel/meshtastic

Connects Tesel to a Meshtastic radio over Web Bluetooth and exchanges frames (events Tesel has sealed, which this package neither seals nor opens) as packets on the group's channel, as specified in [`docs/protocol.md`](../../docs/protocol.md) §7.2 and decided in [ADR-0098](../../docs/decisions/0098-meshtastic-radios.md).

Meshtastic's own libraries are GPL-3.0 and Tesel is EUPL-1.2, so nothing here comes from them: the protobuf codec and the messages are written for Tesel from the public protocol definitions, whose field numbers and Bluetooth UUIDs are interoperability facts. Do not add `@meshtastic/*` packages as dependencies, nor copy or adapt their code.

| File                  | Responsibility                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `service.ts`          | The radio's Bluetooth service and characteristics: the package's light entry, `@tesel/meshtastic/service`, used by the picker |
| `meshtastic-radio.ts` | `RadioLink` over a Meshtastic radio, on the connection keeper of `@tesel/radio`, and the nodes it hears (`onNode`)            |
| `channels.ts`         | Which of the radio's eight channels holds a group                                                                             |
| `nodes.ts`            | The other Meshtastic nodes heard: names and last positions                                                                    |
| `air.ts`              | Time on air of a frame, from the radio's LoRa settings                                                                        |
| `connection.ts`       | The connection the link uses, small so that tests can fake it                                                                 |
| `web-ble.ts`          | Opening a radio: pairing and the configuration handshake                                                                      |
| `ble-connection.ts`   | The connection over Bluetooth: reading FromRadio until empty, writing ToRadio, which packets the radio took                   |
| `to-radio.ts`         | The messages Tesel writes: `ToRadio`, `MeshPacket`, `Data`, `AdminMessage.set_channel`                                        |
| `from-radio.ts`       | The messages Tesel reads: `FromRadio` and what it carries                                                                     |
| `schema.ts`           | Field numbers and values of those messages                                                                                    |
| `protobuf.ts`         | A minimal protobuf wire codec: varints, 32-bit and length-delimited fields                                                    |

Beyond the contract, `MeshtasticRadio.onNode` tells the names and positions of the other nodes the radio hears, so that people who carry a Meshtastic radio without Tesel can be shown. The app does not draw them yet.
