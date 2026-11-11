# Images

`hero.jpg` and `hero-tall.jpg`: hikers with headlamps at blue hour, by Maël Balland on Unsplash (<https://unsplash.com/photos/pG5_vXaRj9s>), under the Unsplash licence. Cropped and slightly darkened for the home page.

`app-tablet` and `app-phone`: screenshots of the real app, staged with a fictional team in Valencia
by the simulator (`pnpm --filter @tesel/simulator screenshots`, see `tools/simulator`):
`tablet-chat.png` and `phone-map.png`, resized to 1800 and 640 pixels wide and saved as WebP and
JPEG. The base map is Tesel's own (OpenStreetMap data, Protomaps). Map data © OpenStreetMap
contributors, ODbL. When the logo changed (ADR-0095) only the header's logo was redrawn in them, at the size and
place the app gives it; take them again with the simulator when the app itself changes. For ADR-0113 they were taken again with the base map of tesel.eu, read in a browser for the area of the views and given to the simulator with `--tiles`. For the mark of ADR-0116 only the header's logo was redrawn in them again. For the logo of ADR-0129 too: the word and its tile on wide screens, the mark on the phone's, drawn at the size and place the app gives them, on the bar's ink.

`net-coverage.svg`, `net-mesh.svg` and `net-bridge.svg`: the home page's diagrams of how a message travels (ADR-0088, redrawn in ADR-0113): with coverage, through the server; without it, from node to node over the mesh; and through a phone that bridges both. Each is a panel of the dark section with phones, the server and nodes drawn after the MeshTracker X1. No words, so both languages share them. Written by `tools/site-diagrams/build.py`; change them there.

`share-es.jpg` and `share-en.jpg`: the picture a link to the home page shows when shared (Open Graph), 1200 × 630, one per language: `hero.jpg` darkened towards the left in graphite, with the pale logo, the home page's eyebrow and heading in Archivo, and the address. Rendered from a small HTML page in Chromium and saved as JPEG; to change the words, render them again the same way. For the logos of ADR-0095 and ADR-0116 only the lockup was replaced: the picture under the old one rebuilt from `hero.jpg`, the new one drawn as tall as the old, where it stood. For the logo of ADR-0129 the old lockup was painted out of the picture (OpenCV's inpainting, on the dark sky behind it) and the pale logo drawn from the same left edge, its l as tall as the old word's.
