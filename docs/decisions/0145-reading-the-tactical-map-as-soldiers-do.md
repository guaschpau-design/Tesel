# 0145. Reading the tactical map as soldiers do

- Status: Accepted
- Date: 2026-11-19

## Context

With the tactical map in coyote (ADR-0144), Pau asked for it to serve a military kind of operation better still. Of the improvements proposed he chose: MGRS coordinates with the tactical map, bearings in mils, the zone and square always in sight, the ways off the streets and the buildings for moving over the ground, the magnetic declination for a compass, and NATO symbology (APP-6). The last changes how every marker looks and is decided apart, once Pau has seen a sketch of it.

## Decision

- **Bearings in mils**, NATO's 6400 to the turn, written with four digits, "0836‰ NE", beside degrees, "047° NE": a preference, «Rumbos en» in Settings (`bearingUnit`).
- **Bearings from magnetic north**, for a compass: a preference, «Norte de los rumbos» (`north`). A magnetic bearing is the true one less the declination where the map is centred, and carries an M, "045°M NE". Every bearing on screen (a point, guidance, the pocket screen, the radar) is written the same way (`navigation/bearings.svelte.ts`, `formatBearing`).
- **The declination** comes from the World Magnetic Model 2025 (NOAA and the British Geological Survey, public domain, valid to 2030), worked out in the app from its coefficients (`navigation/declination.ts`), offline, again whenever the map's centre moves a tenth of a degree.
- **The tactical maps come read as a military map is**: choosing «Táctico» or «Nocturno» turns on the MGRS grid (ADR-0141), MGRS coordinates, bearings in mils and from magnetic north. Each can be changed again in Settings or the layers.
- **The map's margin** on the tactical maps, under the scale: the MGRS zone and 100 km square of the map's centre, "31T DG", and the declination there, "Decl. 2,0° E" (`map/MapMargin.svelte`).
- **Moving over the ground** on the tactical maps: tracks in dark brown dashes, footpaths and steps in black dots and bars, mountain huts with their sign and, in Spain, every building of the cadastre (ADR-0139), in the map's colours by day and in reds at night (`TACTICAL_LOOKS`).
- The settings that pick one of a list share one row (`ui/ChoiceRow.svelte`), the coordinate format's among them.

## Consequences

- A team can read a position off the map, give it by radio in MGRS, and walk it with a compass in mils, as soldiers are taught.
- The declination is a model's, good to a fraction of a degree; near strong local anomalies a compass may differ more.
- Choosing a tactical map changes three settings a user may have chosen otherwise; they are not set back on leaving it.
