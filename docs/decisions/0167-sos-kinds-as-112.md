# 0167. SOS kinds as the 112 sorts emergencies

- Status: Accepted
- Date: 2026-11-24

## Context

An SOS says what help it calls for (protocol §3.8): general, medical, people trapped, fire or security. Pau asked whether those are how the 112 and similar services sort emergencies.

Every Spanish 112 keeps its own list of incident types, but all of them fall into the same few blocks, the services the 112 sends:

- **Madrid:** health, fire, rescue and public safety.
- **Andalucía and the Balearic Islands:** the same, with traffic among the largest.
- **Europe's 112 apps:** ambulance, fire and police.

Two of the SOS kinds did not fit:

- **«Personas atrapadas»** is one case of rescue; people lost in the hills or in the water are another.
- **A traffic accident**, one of the most frequent calls, had no kind of its own.

## Decision

- **Kind `2` is now rescue:** people trapped, lost or in the water. Its code stays, so devices with an older version read it as before, under its old name.
- **Kind `5` is new: a traffic accident.** Older versions read it, as any reserved kind, as general.
- **The dialog shows six kinds,** in two rows of three:
  - Emergencia, Médica, Fuego;
  - Rescate, Accidente de tráfico, Seguridad.

  Rescue has a ring buoy and the accident a car, two new pictograms.

- **General stays:** it is what a device sends by itself when its member does not answer the check-in (ADR-0064).
- **The situation report keeps its finer list** (ADR-0063): an SOS must take one tap under stress.

## Consequences

- What a member tells the 112 from an SOS card (ADR-0127) names the kind as the 112 would.
- A traffic accident from a newer device shows as «Emergencia» on an older one until it is updated.
