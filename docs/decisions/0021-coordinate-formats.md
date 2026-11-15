# 0021. Write coordinates in four formats, converted by our own code

- Status: Accepted, amended by [0135](0135-measuring-shows-the-ground.md) (a dictated coordinate is typed as a marker or a task's place; no panel to find it)
- Date: 2026-10-26

## Context

Teams read coordinates aloud over the radio and write them in reports. Phones and 112 apps share decimal degrees; paper maps and aviation use degrees, minutes and seconds; Spanish fire, forest and civil protection services work in UTM; ATAK, NATO forces and many rescue teams use MGRS. A coordinate dictated in one format must be found on the map, and a point must be readable in whichever format the listener uses.

## Decision

- The app writes and reads four formats: decimal degrees, degrees-minutes-seconds, UTM and MGRS (`apps/web/src/lib/coordinates/`). Each device chooses one, remembered as a preference; decimal degrees is the default. The MGRS grid can be drawn over the map, off by default (added 2026-10-27): lines every 100 km, 10 km, 1 km or 100 m as the zoom allows, labelled with their digits, the 100 km squares named and the zone edges marked.
- All coordinates are WGS 84, the datum of GPS. ETRS89, the official European datum, differs from it by well under a metre, which does not matter in the field; we do not convert between them.
- The conversions are our own code, about 450 lines with their comments: Krüger's series to the third order for UTM, accurate to a millimetre within a zone, and the standard MGRS lettering. Tests compare them with PROJ and with NGA's GEOTRANS. The JavaScript libraries we looked at cover only part of this (MGRS without UTM text, or no parsing), and the mathematics is stable and well documented.
- Reading is lenient where people are: signs or hemisphere letters (O for west), decimal commas, with or without symbols, UTM with a latitude band (Spanish usage) or a hemisphere. An MGRS square with fewer digits is read as its centre.
- Near the poles, outside UTM, only the degree formats are shown.

## Consequences

- The coordinate formats work offline and add no dependency.
- Formats beyond these four (British or Irish grids, GARS) would need their own module; none is planned.
- A team that mixes datums with older maps (ED50, still printed on some Spanish maps, is about 100–200 m off) must convert outside the app.
