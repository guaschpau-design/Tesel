# 0053. Load the heavy parts of the app on demand, MapLibre in a file of its own

- Status: Accepted, amended by [0098](0098-meshtastic-radios.md) (the radio contract in `@tesel/radio`, each kind loaded when picked)
- Date: 2026-10-28

## Context

The web app was built into one JavaScript file of 1.9 MB. Every release changed its name, so every installed app downloaded all of it again, and every visit parsed all of it before showing the map. About half of it was MapLibre, which changes only when we update it. Three other parts are used by few people, or rarely: the satellite map, with the outlines of Spain, Portugal and southern France where it lays each country's photographs (240 KB of generated coordinates); the QR code reader (130 KB), used to join a group from inside the app; and the MeshCore radio library, used only by those who pair a radio.

The app must still work offline once installed: the service worker caches every file of the build when it installs (`globPatterns` in `apps/web/vite.config.ts`), so a part loaded on demand is already on the device when it is first needed.

## Decision

- **MapLibre** goes into a chunk of its own (`codeSplitting` in `apps/web/vite.config.ts`). Its name depends only on its contents, so a release of the app that does not update MapLibre leaves it as it is, and the service worker keeps it.
- **The satellite map** (`map/ortho.ts`) and its outlines are imported the first time one of its tiles is asked for, through `lazyArchive` (`map/tile-sources.ts`). What the map's style needs at start, its credit and deepest zoom, lives in `tile-sources.ts` with the other sources'.
- **The QR reader** (jsQR) is imported when the camera opens to scan (`groups/qr-scanning.ts`).
- **The radio**: `RadioSession` makes its link at the first connection, importing `@tesel/meshcore` then. The package has a light entry, `@tesel/meshcore/link` (`radio-link.ts`): the contract, the errors a link rejects with, and whether the browser can reach a radio. The app imports only that at start.

## Consequences

- When this was decided, the file every visit runs first went from 1.9 MB to 475 KB, and MapLibre's 1 MB is downloaded again only when MapLibre changes.
- The service worker still caches every chunk at install, so nothing changes offline. Each chunk on demand is a separate request the first time online, which the cache serves after.
- Code that pulls one of these parts back in statically, for instance an import of `@tesel/meshcore` instead of `@tesel/meshcore/link`, merges it into the main file again without any error. The sizes the build prints are the check.
