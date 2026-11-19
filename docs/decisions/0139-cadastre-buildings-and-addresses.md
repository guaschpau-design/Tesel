# 0139. The cadastre's buildings, official house numbers and addresses, in Spain

- Status: Accepted, amended by [0149](0149-one-layer-of-buildings-and-tidier-layers.md) (in Spain, the cadastre's buildings alone on the flat map)
- Date: 2026-11-15

## Context

The urban map (ADR-0137) and the topographic map draw OpenStreetMap's buildings, which volunteers trace: some towns have them all, others miss whole streets that the photographs show. Its house numbers are as patchy. A dispatcher gives an address, not coordinates, and the app could only take coordinates (ADR-0077).

IGN's vector map of Spain (Mapa Base), which the topographic map already reads for its names of the terrain (ADR-0034), holds every building of the cadastre (`edificio_pol`) and CartoCiudad's official house numbers (`portal_pto`, its number in `ref`), in its tiles from zoom 16. CartoCiudad, the official geocoder of IGN and the cadastre, finds an address of Spain, free, with no key, and answers any web page (`Access-Control-Allow-Origin: *`).

## Decision

- **The cadastre's buildings** are drawn over OpenStreetMap's on the topographic and urban maps, in each map's look (`map/style/cadastre.ts`): as its own buildings, which on the urban map are now opaque and edged. With the ground in 3D, those OpenStreetMap does not hold are raised to two floors, under OpenStreetMap's, which keep their heights. Outside Spain IGN's tiles are empty and OpenStreetMap's buildings stay alone.
- **The official house numbers** on the urban map, from zoom 17, before OpenStreetMap's, which fill in elsewhere.
- **IGN's map is read and downloaded one zoom deeper than the OpenStreetMap map** (`IGN_MAX_ZOOM`, 16), where those are. Areas downloaded before keep it to the zoom they were downloaded at, until downloaded again.
- **An address is typed where coordinates are**, on a tool's card (a marker, a task's place): what is not coordinates and has words is asked of CartoCiudad (`coordinates/address-search.ts`), and the user picks among up to five places it finds. It needs the network; coordinates do not, and the card says so.

## Consequences

- In Spain every building and every door is on the map, offline as online, and a dispatched address becomes a marker in two taps.
- An area's download is larger: IGN's tiles to zoom 16 are about four times as many as to 15.
- Addresses are of Spain only; abroad, coordinates or a tap.
