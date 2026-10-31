# 0084. The guide, plate by plate

- Status: Accepted
- Date: 2026-11-01

## Context

The site's guide (`guia/`, `en/guide/`) had grown into a reference manual: about 3,300 words of prose, thirteen screens tall on a computer, with two screenshots and one diagram. "During an operation" was thirteen points of about 120 words each, every one mixing what a feature is, how it is used and its fine print; "Finding your way" held the settings too. Finding how to invite someone meant reading it all. The help on one page ([ADR-0083](0083-help-on-one-page.md)) now answers what each button is and how the usual things are done, and showed that a drawing and the taps written as chips are read at a glance.

## Decision

- The guide is twelve **plates**, one idea each: what Tesel is, getting started, the group, Me, chat and reports, marking the ground, tasks and sweeps, SOS and "Are you OK?", finding your way, without internet, the diary, security. Then the settings, as a short list, and what to do when something fails, folded.
- Each plate has a **drawing** beside its number and title (on a phone, above them; every other plate on the other side), a lead of one or two sentences, the **moves** as small cards with the taps as chips like the app's buttons (`Añadir → Zona → Zona del operativo`), and the fine print folded under «Detalles». Nothing the old guide said is dropped: what is not needed at first is folded, not deleted.
- The drawings (`img/guide/*.svg`) are drawn by hand with the app's own pictograms, like the help's, and have no words, so both languages share them. Lime numbers on a drawing match the numbered chips of its plate. They are not screenshots: they stay legible on a phone and do not change with every small change of the app.
- Button names are written as chips everywhere in the guide, in the moves and in the fine print alike. The pictograms the guide uses are one symbol file (`img/guide/icons.svg`), copied from the app's `glyphs.ts`.
- The cover's index is a tile per plate, with its pictogram. The help links the plate about working without internet.
- Printed, each plate keeps together and the fine print and the troubleshooting are left out, as a sheet cannot unfold them: the guide takes seven A4 sheets instead of about twenty.

## Consequences

- What is visible is about a third of the old text; the rest is one tap away.
- A plate's drawing must change when its part of the app does, as `help-screen.svg` must ([ADR-0083](0083-help-on-one-page.md)). The tablet SOS screenshot the guide used is gone; the home page keeps its screenshots.
