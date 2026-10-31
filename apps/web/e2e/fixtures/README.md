# End-to-end fixtures

`test-basemap.pmtiles` is a tiny synthetic basemap (360 tiles around Valencia, zoom 0 to 15: land, sea, a road grid, one place label, a hospital and, at zoom 15 only, a pharmacy; from zoom 14, named streets every 100 m round the centre with a footpath and a motorway, a stream and a park) in the Protomaps layer schema. It lets the end-to-end tests render a real map without network access to any tile server.

It was generated with `make-test-basemap.py`:

```sh
pip install pmtiles mapbox-vector-tile shapely
python3 make-test-basemap.py test-basemap.pmtiles
```

## Screenshot baseline

`../offline.e2e.ts-snapshots/offline-valencia-linux.png` is the map drawn from a downloaded area with no network, which `offline.e2e.ts` compares against. Only the map is compared: its glyphs and sprites ship with the app, and the controls, dock and SOS button are masked, so system fonts do not matter. The baseline is Chromium's drawing with SwiftShader on Linux, as Playwright's pinned version (`apps/web/package.json`) installs it, and CI compares against it; a test run on another system writes its own baseline beside it, which is not committed.

When a change to the map's look changes the drawing on purpose, regenerate it on Linux and check the new picture before committing it:

```sh
pnpm --filter ./apps/web exec playwright test e2e/offline.e2e.ts --update-snapshots
```
