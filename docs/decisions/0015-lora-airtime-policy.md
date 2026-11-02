# 0015. LoRa airtime policy

- Status: Accepted, amended by [0043](0043-radio-delivery.md) (SOS repeats and bridging of urgent events), [0098](0098-meshtastic-radios.md) (airtime estimated by each kind of radio)
- Date: 2026-10-25

## Context

EU rules allow a transmitter at most 10 % airtime in the 869.4–869.65 MHz sub-band that MeshCore's EU/UK Narrow preset uses. By the conservative estimate below, a Tesel event takes 0.4 to 1.6 s on the air at SF8 and 62.5 kHz, so one device can send only a few hundred events an hour, and every repeater in the mesh spends airtime on each flood too. Without a policy, positions alone would use the budget and an SOS could be stuck behind them.

## Decision

- One scheduler per device (`packages/core/src/lora-scheduler.ts`), pure and tested, decides what goes on the air and when.
- Ordinary traffic may use 5 % of the rolling hour, half the legal limit, leaving room for the mesh. `SOS`, `SOS_CANCEL` and alerts may use the full 10 %.
- Airtime is estimated with Semtech's formula, taking the coding rate (4/8) and preamble (16 symbols) at their most expensive, so estimates err on the safe side.
- Positions are thinned (own: 2 minutes and 50 m or 10 minutes; bridged: 5 minutes per member); an own `SOS` repeats with back-off until acknowledged or cancelled; own `ACK`s follow the protocol's random-delay rule.
- Bridging rules live in the same scheduler, so one component owns all decisions about the air: bridged events wait 0–10 s, are dropped if heard meanwhile, and are not bridged at all if older than 10 minutes.

## Consequences

- Over LoRa a group sees positions every few minutes, not live; the interface marks positions older than 10 minutes as stale.
- The budget is kept per device, in memory: an app restart forgets what was spent in the last hour. The 5 % ceiling for ordinary traffic absorbs that error.
- `bridge.ts`, planned earlier as a separate module, is not needed.
