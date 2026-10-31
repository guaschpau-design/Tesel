# Images

`hero.jpg` and `hero-tall.jpg`: hikers with headlamps at blue hour, by Maël Balland on Unsplash (<https://unsplash.com/photos/pG5_vXaRj9s>), under the Unsplash licence. Cropped and slightly darkened for the home page.

`app-tablet` and `app-phone`: screenshots of the real app, staged with a fictional team in Valencia
by the simulator (`pnpm --filter @tesel/simulator screenshots`, see `tools/simulator`):
`tablet-chat.png` and `phone-map.png`, resized to 1800 and 640 pixels wide and saved as WebP and
JPEG. The base map is Tesel's own (OpenStreetMap data, Protomaps). Map data © OpenStreetMap
contributors, ODbL.

`help-screen.svg`: the app's screen on a phone, drawn by hand for the help page (`ayuda/`, `en/help/`, ADR-0083): the top bar, a map with the group, the map's buttons, SOS and the dock, with the numbers the page explains. It has no words, so both languages share it; when the screen changes, it changes with it.

`guide/`: the guide's plates (`guia/`, `en/guide/`, ADR-0084), one drawing per plate (`what`, `start`, `group`, `me`, `chat`, `mark`, `tasks`, `sos`, `orient`, `offline`, `diary`, `security`), drawn by hand like `help-screen.svg` and with no words, so both languages share them. Lime numbers on a drawing match the numbered chips of its plate. `guide/icons.svg` holds, as symbols, the app's pictograms that the guide uses (copied from `apps/web/src/lib/ui/glyphs.ts`). When a part of the app changes, its plate changes with it.
