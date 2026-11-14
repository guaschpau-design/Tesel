# 0131. Pocket mode and full screen on phones and tablets only

- Status: Accepted
- Date: 2026-11-14

## Context

Pocket mode (ADR-0097, ADR-0127) is for a phone going into a pocket or onto a table. On by default, it also came by itself on a computer left untouched for a minute, and its padlock was among the map's controls there too. Full screen, on by default in a browser tab (CHANGELOG, Map), took a computer's whole screen at the first click. Neither makes sense at a desk.

## Decision

- **A phone or a tablet is a device used by touch**: the Android app, or a browser whose main pointer is coarse, `(pointer: coarse)` (`HANDHELD`, `platform.ts`). A computer with a touch screen still has a mouse as its main pointer, so it counts as a computer.
- **On a computer there is no pocket mode**: no padlock among the map's controls, no «Modo bolsillo automático» in Settings, and it never comes by itself, whatever was chosen before.
- **On a computer full screen starts off.** «Pantalla completa» is still in Settings, for a screen at a command post; switched on, it comes back at the first click of each visit, as on a phone.
- Phones and tablets keep both as they were.

A test (`e2e/desk.e2e.ts`) opens the app as a computer: no padlock, no automatic pocket mode, not full screen at the first click.

## Consequences

- At a desk the app stays as the user left it, in its window.
- A computer that chose full screen before keeps it: the choice was stored. Only the default changed.
