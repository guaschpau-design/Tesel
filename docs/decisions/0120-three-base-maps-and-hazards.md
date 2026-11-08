# 0120. Topographic, satellite and tactical maps; fires and flood zones over them

- Status: Accepted, amended by [0121](0121-flood-zones-through-the-server.md) (flood zones from the Ministry's new service, through the server)
- Date: 2026-11-08

## Context

The street map and the topographic map came from the same OpenStreetMap data and looked much alike (ADR-0035): a team in the field needs the terrain more than another way to see streets. The tactical map, all greys on a dark ground, existed only as what the street map became in dark mode (ADR-0114), so a light app could not have it and a dark app could not have anything else. A study of other base maps (paid outdoor maps and IGN's official topographic map) found none that fits an app that must work offline without fees for each map load; it found two free public services worth showing over the map: fires detected by satellite and the zones floods reach.

## Decision

- **Three base maps, in this order: topographic, satellite and tactical.** The street map is gone; the topographic map is the base map, and those who had the street map chosen get it. The satellite map keeps its sources, still the best open ones: each country's newest orthophotos close up, Sentinel-2 cloudless from afar (ADR-0041).
- **The tactical map is a base map of its own** (`map/style/tactical.ts`), chosen in the layers panel whatever the app's look.
- **The app's look and the map's are apart.** Dark mode darkens the bars, panels and cards and leaves the map as chosen. Each base map has its own look, light for the topographic and satellite maps, dark for the tactical map (`mapThemeOf`, `map/style/style.ts`); the style sets it on the page as `data-map-theme`, and app.css gives the colours of what is drawn on the map (labels, halos, relief, sky) for each.
- **Every download holds the topographic map:** the OpenStreetMap map, IGN's names of the terrain and the elevation, from which the contour lines, the relief and the climbs are worked out. The satellite map is the one extra to choose. The overview of the whole region kept for every user is still the OpenStreetMap map alone.
- **Two layers over the map, off until turned on, online only**, as pictures of the view like the cadastre's (`map/wms/`, which the cadastre now shares):
  - **Fires** (`hazards/hazards.ts`): what the VIIRS sensors of three satellites detected burning yesterday and today, from NASA's GIBS, with no key: each satellite and day is asked for apart, so that a missing one spoils no other. GIBS draws its fire layers only from its EPSG:4326 service, which answers Web Mercator requests, as GIBS documents. Shown from zoom 5.
  - **Flood zones**: where a 100-year flood reaches, Spain's official reference, from the Ministry for the Ecological Transition's SNCZI (layer `NZ.RiskZone`). Shown from zoom 8, translucent. The Basque Country and Navarre publish their own maps, not in it.

## Consequences

- Fewer maps that look alike, and the one most teams need is the first. The tactical map is there by day as by night.
- A download takes longer and more room than before, since it now holds the elevation and IGN's names; in exchange the topographic map, the relief and the climbs work offline in every downloaded area. Areas downloaded before hold only the OpenStreetMap map: the topographic map shows there without contour lines until they are downloaded again.
- What is drawn over a base map follows its look, not the app's: a member's label is dark on the topographic map in a dark app, light on the tactical map in a light one.
- Fire detections are 375 m pixels from satellites passing a few times a day: they tell where something burns, not the fire's edge, and a fire can burn for hours before a pass sees it.
- The services' terms and addresses are outside our control; if one changes, its layer shows nothing, as the cadastre's does offline.
