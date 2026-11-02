# 0056. Keep room for the log, resume downloads, and never show a blank map

- Status: Accepted
- Date: 2026-10-28

## Context

The audit of 27 October 2026 found that the app's storage was handled as if it never ran out:

- The browser was asked to keep the app's data (`navigator.storage.persist()`) only when a map was downloaded. A member who never downloaded one could lose the identity, the groups and their logs whenever the browser made room.
- A write refused for lack of room (`QuotaExceededError`) was not handled anywhere: an action failed with the usual "could not be done", events from the relay failed in silence, and nothing said that the storage was full.
- Downloads did not check that there was room, and could fill the storage the group's log needs.
- One tile that failed stopped a whole download, and the interface stayed on "downloading", since the other requests went on reporting progress after the download had failed. An incomplete area could only be deleted and downloaded again.
- Offline, with no area downloaded, the map was blank: not even the coast or the borders.

## Decision

- **The browser is asked to keep the app's data** when the identity is created, when a group is created or joined, and after each download. It may say no the first time and yes later, as a site is used more.
- **The log comes first.** Maps are stored only if what the browser says is free leaves 50 MB besides for the group's log, which takes a few megabytes a day of a large group (ADR-0055). A download that does not fit does not start, and says how much it needs and how much there is.
- **A full storage is said, once for each refusal,** in one notice that offers the offline maps, which are what can be deleted to make room (`ui/submission.svelte.ts`). Nothing is lost meanwhile: an own event is stored with its outbox entry in one transaction or not at all, and the form or button that sent it says it failed; events from the relay are stored with the cursor that read them, so the relay sends them again; frames from the radio are tried again. Tiles kept because they were seen are the first thing dropped when the storage is full.
- **A download tries each tile four times,** waiting 1, 2 and 4 seconds between tries. A tile that still fails is left out and the area stays incomplete; eight tiles failing in a row stop the download, since the service is out of reach. A web service's server errors and refusals for too many requests are failures; its other client errors mean there is no tile. Each source keeps its number of requests at a time (ADR-0011, `offline-maps.ts`). The first failure stops every request, and nothing reports progress once the download has stopped.
- **An incomplete area can be resumed.** A download, resumed or new, fetches only the tiles not stored yet: those another area, the overview or the map's viewing already holds are kept for this area too.
- **An overview of the base map is kept** from the first start with a connection: its zooms 0 to 6 over all the base map covers, as its PMTiles header says, so that land, borders and the big places are always there. Its tiles belong to the overview, not to an area; deleting areas leaves them. The map our servers publish, Spain and Portugal, takes 42 tiles to zoom 6. Protomaps tiles of zooms 0 to 6 weigh 130 to 790 KB each, the lower zooms more (measured on Protomaps' sample extract of Florence, the only one we could reach), so the overview takes about 12 MB. A map of the world would need 5,461 tiles to zoom 6, hundreds of megabytes by Protomaps' rule that each zoom doubles the size of a 120 GB planet; the overview takes at most 100 tiles, which gives such a map zooms 0 to 3.
- **The tiles the map shows while online are kept,** up to 64 MB, the first kept the first to go (a tile kept is drawn from storage, so when it was last looked at is not recorded), so a place seen online can be seen again without a connection. A tile an area or the overview needs is not the cache's to drop.

## Consequences

- Without a connection the map shows, from most to least detail: downloaded areas, places seen lately, and the overview. Downloaded areas remain the way to prepare for an incident.
- The app's storage grows by the overview (about 12 MB with our map) and by up to 64 MB of tiles seen, before any area is downloaded.
- A download through a flaky connection finishes with what it could get, and the rest can be resumed later instead of starting again.
- The browser's estimate of free space is approximate and some browsers do not give it; without one, downloads start and a full storage is handled when it happens.
- Areas downloaded by earlier versions resume like any other: their tiles are found in the store.
