// Builds the buildings archive the server publishes at /maps/buildings.pmtiles (ADR-0161): the
// buildings of Overture Maps' latest release in an area, kept light (slim-buildings.ts), at the
// zooms the app draws them. deploy/vps/buildings.sh runs it every month in the server's image:
//
//   node apps/server/src/maps/build-buildings.ts --bbox=WEST,SOUTH,EAST,NORTH --out=FILE
//                                                [--release=ID]
//
// Overture publishes each release's buildings as a PMTiles archive of the whole world; only the
// tiles of the area are read from it, a few at a time, each tried again a few times before the
// build gives up. Without --release the latest release is taken from Overture's catalogue.

import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

import { FetchSource, PMTiles, TileType } from 'pmtiles';

import { parseBounds, tilesOf, type Bounds, type TileRef } from './area.ts';
import { attempt, inTurn } from './fetching.ts';
import { PmtilesWriter } from './pmtiles-writer.ts';
import { BUILDING_FIELDS, BUILDING_LAYER, slimBuildings } from './slim-buildings.ts';

const CATALOGUE = 'https://stac.overturemaps.org/catalog.json';
/** Overture's release IDs: the date, and a revision. */
const RELEASE = /^\d{4}-\d{2}-\d{2}\.\d+$/;

function releaseArchive(release: string): string {
  return `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${release}/buildings.pmtiles`;
}

/**
 * The zooms the app reads buildings at (map/tiles/sources.ts): from a neighbourhood's, and to
 * Overture's deepest, which MapLibre enlarges beyond.
 */
const BUILDINGS_MIN_ZOOM = 13;
const BUILDINGS_MAX_ZOOM = 14;
/** Tiles asked for at once. */
const CONCURRENCY = 16;

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> ' +
  '<a href="https://docs.overturemaps.org/attribution" target="_blank">© Overture Maps Foundation</a>';

async function latestRelease(): Promise<string> {
  const response = await fetch(CATALOGUE);
  if (!response.ok) throw new Error(`Overture's catalogue answered ${String(response.status)}`);
  const latest: unknown = ((await response.json()) as Record<string, unknown>)['latest'];
  if (typeof latest !== 'string' || !RELEASE.test(latest)) {
    throw new Error(`Overture's catalogue names no latest release`);
  }
  return latest;
}

/** The light tile of one of the area's, compressed; null where it has no buildings. */
async function lightTile(archive: PMTiles, { z, x, y }: TileRef): Promise<Uint8Array | null> {
  const found = await attempt(() => archive.getZxy(z, x, y));
  if (found === undefined) return null;
  const light = slimBuildings(new Uint8Array(found.data));
  return light === null ? null : gzipSync(light);
}

async function build(bounds: Bounds, out: string, release: string): Promise<void> {
  const archive = new PMTiles(new FetchSource(releaseArchive(release)));
  if ((await archive.getHeader()).tileType !== TileType.Mvt) {
    throw new Error(`Overture's ${release} buildings are not vector tiles`);
  }
  const tiles = tilesOf(bounds, BUILDINGS_MIN_ZOOM, BUILDINGS_MAX_ZOOM);
  const writer = await PmtilesWriter.create(out);
  process.stdout.write(
    `Overture ${release}: reading ${String(tiles.length)} tiles of ${bounds.join(',')}\n`,
  );
  const step = CONCURRENCY * 16;
  let reported = 0;
  for (let start = 0; start < tiles.length; start += step) {
    const batch = tiles.slice(start, start + step);
    const light = await inTurn(batch, CONCURRENCY, (tile) => lightTile(archive, tile));
    for (const [index, bytes] of light.entries()) {
      const tile = batch[index];
      if (tile !== undefined && bytes !== null) await writer.add(tile.id, bytes);
    }
    const done = Math.floor(((start + batch.length) * 10) / tiles.length);
    if (done > reported) {
      reported = done;
      process.stdout.write(
        `${String(done * 10)} %: ${String(writer.tiles)} tiles with buildings\n`,
      );
    }
  }
  await writer.finish({
    minZoom: BUILDINGS_MIN_ZOOM,
    maxZoom: BUILDINGS_MAX_ZOOM,
    bounds,
    centerZoom: BUILDINGS_MIN_ZOOM,
    metadata: {
      name: 'Tesel buildings',
      description: `Buildings of Overture Maps release ${release}, kept light for Tesel`,
      attribution: ATTRIBUTION,
      type: 'overlay',
      vector_layers: [
        {
          id: BUILDING_LAYER,
          fields: BUILDING_FIELDS,
          minzoom: BUILDINGS_MIN_ZOOM,
          maxzoom: BUILDINGS_MAX_ZOOM,
        },
      ],
      'tesel:overture_release': release,
    },
  });
  process.stdout.write(`Buildings ready: ${String(writer.tiles)} tiles\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { bbox: { type: 'string' }, out: { type: 'string' }, release: { type: 'string' } },
  });
  if (values.bbox === undefined || values.out === undefined) {
    throw new Error(
      'usage: build-buildings.ts --bbox=WEST,SOUTH,EAST,NORTH --out=FILE [--release=ID]',
    );
  }
  const release = values.release ?? (await latestRelease());
  if (!RELEASE.test(release)) throw new Error(`not an Overture release: ${release}`);
  await build(parseBounds(values.bbox), values.out, release);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
