# Images

`hero.jpg` and `hero-tall.jpg`: hikers with headlamps at blue hour, by Maël Balland on Unsplash (<https://unsplash.com/photos/pG5_vXaRj9s>), under the Unsplash licence. Cropped and slightly darkened for the home page.

`app-tablet` and `app-phone`: screenshots of the real app, staged with a fictional team in Valencia
by the simulator (`pnpm --filter @tesel/simulator screenshots`, see `tools/simulator`):
`tablet-chat.png` and `phone-map.png`, resized to 1800 and 640 pixels wide and saved as WebP and
JPEG. The base map is Tesel's own (OpenStreetMap data, Protomaps). Map data © OpenStreetMap
contributors, ODbL.

`net-coverage.svg`, `net-radio.svg` and `net-bridge.svg`: schemes drawn by hand for the home page (ADR-0088), in light lines for its dark section: a message with coverage, without it (passed from radio to radio) and through a phone that bridges both. No words, so both languages share them.

`share-es.jpg` and `share-en.jpg`: the picture a link to the home page shows when shared (Open Graph), 1200 × 630, one per language: `hero.jpg` darkened towards the left, with the pale lockup, the home page's eyebrow and heading in Archivo, and the address. Rendered from a small HTML page in Chromium and saved as JPEG; to change the words, render them again the same way.
