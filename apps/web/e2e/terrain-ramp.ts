// Elevation tiles for the browser tests, made as they are asked for: ground that rises steadily
// northwards, half a metre for every pixel of the most detailed tiles (about 9 m at Valencia's
// latitude), from 100 m along the southern edge of Valencia's tile. Being made from where each
// pixel is on the earth, the ground runs on across tiles with no step. Terrarium encoding, as PNG.

import { deflateSync } from 'node:zlib';

import type { Page } from '@playwright/test';

const SIZE = 512;
const MOST_DETAILED_ZOOM = 13;
/** Valencia's row of tiles at the most detailed zoom. */
const VALENCIA_ROW = 3117;
const METRES_PER_PIXEL = 0.5;

/** Serves the rising ground for every elevation tile a page, or a whole device, asks for. */
export async function serveTerrainRamp(target: Pick<Page, 'route'>): Promise<void> {
  await target.route(/^https:\/\/tiles\.mapterhorn\.com\/(\d+)\/\d+\/(\d+)\./, (route) => {
    const [, zoom = '0', row = '0'] = /\/(\d+)\/\d+\/(\d+)\./.exec(route.request().url()) ?? [];
    return route.fulfill({ contentType: 'image/png', body: rampTile(Number(zoom), Number(row)) });
  });
}

/**
 * Stands in for the public services the topographic map is downloaded from besides our own map
 * (offline/offline-maps.ts): the rising ground for the elevation, and IGN's names of the terrain
 * answered with no tile, as for a place with no names.
 */
export async function serveTopographicData(target: Pick<Page, 'route'>): Promise<void> {
  await serveTerrainRamp(target);
  await target.route('https://vt-mapabase.idee.es/**', (route) => route.fulfill({ status: 404 }));
}

function rampTile(zoom: number, row: number): Buffer {
  const scale = 2 ** (MOST_DETAILED_ZOOM - zoom);
  const lines: Buffer[] = [];
  for (let line = 0; line < SIZE; line++) {
    const pixelsNorth = (VALENCIA_ROW + 1) * SIZE - (row * SIZE + line) * scale;
    const metres = Math.max(0, 100 + pixelsNorth * METRES_PER_PIXEL);
    const value = metres + 32_768;
    const pixel = [Math.floor(value / 256), Math.floor(value) % 256, 0];
    lines.push(Buffer.from([0, ...Array.from({ length: SIZE }, () => pixel).flat()]));
  }
  return png(Buffer.concat(lines));
}

/** A PNG of truecolour rows, each led by its filter byte. */
function png(rows: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(kind: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(kind, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
