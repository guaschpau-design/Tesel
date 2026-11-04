# 0020. Signal lime, colours defined once, and symbols of our own

- Status: Accepted, colours revised by [ADR-0113](0113-graphite-and-device-lime.md)
- Date: 2026-10-26

## Context

The app, the site and the logo used signal orange for the one action on each screen. Orange is the most common accent of apps and sites, and in this app it also clashed with meaning: warnings are amber and fire is orange. Its value was written by hand in eight places across the app, the map layers and the site. Map symbols were emoji on a white disc: they looked different on every platform and out of place on the map.

## Decision

- **Signal lime** (`#c8f04a`), the high-visibility yellow-green of rescue gear, replaces orange as the brand's signal: the lit tile of the logo, the primary action, and the marks of this device. It sits apart from the colours that carry meaning (red for SOS and danger, amber for warnings, blue for other members and information). Lime does not stand out on white, so on light surfaces text and lines take a deep shade (`#4d6e00`, 5:1 on white), primary buttons carry ink on lime (12.7:1), and this device's dot on the map has an ink ring.
- **Colours are defined once.** The brand's in `brand/colors.json`, read by the logo's generator; the app's as CSS variables in `apps/web/src/app.css`, which the map reads through `lib/ui/theme.ts` because MapLibre cannot read CSS; the site's in its own stylesheet, which has no build step (ADR-0017). A test keeps the three in step.
- **Map symbols are our own**: a pictogram drawn on a 24-unit grid (`lib/objects/glyphs.ts`) on a hexagonal tile like those of the logo, in the colour of its family — people and health red, hazards orange and amber, water blue, safety and logistics green, command ink. The same paths draw the map's markers and the symbols in forms.

## Consequences

- Changing a colour means changing one line; the test fails if the site or the app drifts from the brand.
- A new symbol needs a pictogram in `glyphs.ts` and an entry in `catalog.ts`; its protocol code (§4.1) is unaffected.
- The site's screenshots of the app had to be taken again, with the simulator (`tools/simulator`).
