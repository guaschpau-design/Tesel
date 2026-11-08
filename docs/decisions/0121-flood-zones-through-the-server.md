# 0121. Flood zones through the server that serves the app

- Status: Accepted
- Date: 2026-11-08

## Context

The flood zones layer (ADR-0120) asked `wms.mapama.gob.es/sig/Agua/ZI_LaminasQ100/wms.aspx` from the browser. On 8 November that address answered every request with a .NET error (`NullReferenceException` in `ConstruirServiceArcGISBaseUrl`), with either case of `agua`: the Ministry has moved its flood zone maps to a GeoServer, `gis.miteco.gob.es/geoserver/agua/wms`, layer `Zi_laminas_q100`, as its own directory of water services lists. Another project that reads that GeoServer from the browser notes that it sometimes answers with a broken `Access-Control-Allow-Origin: *, *`, which browsers refuse; a picture they refuse cannot be drawn on a WebGL map.

## Decision

- **The server that serves the app draws the flood zones of a view** (protocol §8.3, `apps/server/src/flood-zones.ts`): `GET v1/flood-zones` with the view's `BBOX`, `WIDTH` and `HEIGHT`, and nothing else is read. It asks the Ministry's GeoServer for its 100-year layer only, for a view within Spain only, and passes on only a PNG of at most 8 MB, which browsers may keep a day. At most 8 pictures are asked at once; past that, clients are told to wait.
- **The app asks its own server** (`floodServices` in `hazards/hazards.ts`), the one that serves it (config.ts); a build with no server shows no flood zones.

## Consequences

- The layer no longer depends on the Ministry's cross-origin headers, and the app keeps its one origin for this as for the weather warnings.
- The server makes requests to the Ministry for its users, each a view someone looks at; the Ministry sees the server's address, not theirs.
- If the Ministry moves its service again, one address in the server changes, and every app follows without an update.
