# 0113. Graphite and the lime of the node

- Status: Accepted
- Date: 2026-11-04

## Context

Tesel's colours were a navy ink, the night map, and a yellow-green lime (ADR-0020). The pocket node the site shows and the team carries, the Seeed SenseCAP MeshTracker X1, is a graphite card with a green button, sold in a graphite box lined in the same green. The app on the phone and the node in the pocket look like two products. The three diagrams of the home page that show how a message travels were thin outlines on the dark background and read as sketches.

## Decision

- **Graphite instead of navy.** The ink becomes a neutral graphite (`#18191b`), that of the node's case. Every surface derived from it loses its blue cast as well: in the app, the dark theme's background, surfaces, lines and grey text; on the site, its dark sections, lines and the shade over the photograph. Pale becomes `#ebedeb`.
- **The lime of the node's box.** Signal lime becomes `#99c938`, the green of the MeshTracker X1's box and of its button as printed on it, measured on photographs of the box with their white balance and exposure corrected against the white table they lie on. It is a touch greener and deeper than the old lime. Its deep shade for text and lines on light backgrounds becomes `#49660e`, at least 4.5:1 on every light surface of the app and the site. Ink on lime is 9:1.
- **Nothing else moves.** The colours that carry meaning (red for SOS and danger, amber for warnings, blue for members and information, the families of map symbols) and the base map keep theirs. Lime still marks only the one action on each screen and this device.
- **Diagrams drawn as a series.** The three diagrams are panels of the dark section, drawn to one grid: phones with a map on their screen, the server as a cloud with a padlock (it passes on what it cannot read), and nodes drawn after the MeshTracker X1, with their lime button and the waves of what they send. Grey lines are the internet; dotted lime arcs are the mesh; a lime dot with a halo is the message on its way. The phone that bridges both glows. They are written by `tools/site-diagrams/build.py`, so a change to one is made to all three.
- The values live where ADR-0020 put them: `brand/colors.json`, `apps/web/src/app.css` and `apps/site/styles.css`, kept in step by a test. The logo, the app's icons, the pictures for shared links and the screenshots of the app on the site follow from them.

## Consequences

- The app, the site and the node read as one product.
- The screenshots of the app on the site were taken again with the simulator, so they show the app as it is.
- Lime is now closer to the green of the safety and logistics symbols (`#14915f`). They stay apart in lightness and saturation, and lime appears only on this device and the one action.
