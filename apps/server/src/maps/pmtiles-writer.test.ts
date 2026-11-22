import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PMTiles, tileIdToZxy, zxyToTileId, type Source } from 'pmtiles';

import { PmtilesWriter } from './pmtiles-writer.ts';

/** An archive in memory, as the pmtiles package reads one: by a key of its own, as it caches. */
let archives = 0;
function inMemory(bytes: Buffer): Source {
  const key = `archive-${String(++archives)}`;
  return {
    getKey: () => key,
    getBytes: (offset, length) =>
      Promise.resolve({ data: Uint8Array.from(bytes.subarray(offset, offset + length)).buffer }),
  };
}

const DESCRIPTION = {
  minZoom: 13,
  maxZoom: 14,
  bounds: [1.3, 41.1, 1.5, 41.2] as const,
  centerZoom: 13,
  metadata: { name: 'test' },
};

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pmtiles-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function written(tiles: readonly [number, number, number][]): Promise<PMTiles> {
  const path = join(dir, 'test.pmtiles');
  const writer = await PmtilesWriter.create(path);
  const sorted = [...tiles].sort((a, b) => zxyToTileId(...a) - zxyToTileId(...b));
  for (const [z, x, y] of sorted) {
    await writer.add(
      zxyToTileId(z, x, y),
      gzipSync(Buffer.from(`${String(z)}/${String(x)}/${String(y)}`)),
    );
  }
  await writer.finish(DESCRIPTION);
  return new PMTiles(inMemory(await readFile(path)));
}

async function text(archive: PMTiles, z: number, x: number, y: number): Promise<string | null> {
  const found = await archive.getZxy(z, x, y);
  return found === undefined ? null : new TextDecoder().decode(found.data);
}

describe('a PMTiles archive written', () => {
  it('is read back tile by tile, with its header and metadata', async () => {
    const archive = await written([
      [14, 8255, 6133],
      [13, 4127, 3066],
      [14, 8256, 6133],
    ]);
    expect(await text(archive, 14, 8255, 6133)).toBe('14/8255/6133');
    expect(await text(archive, 13, 4127, 3066)).toBe('13/4127/3066');
    expect(await text(archive, 14, 8257, 6133)).toBeNull();
    const header = await archive.getHeader();
    expect([header.minZoom, header.maxZoom, header.numTileEntries]).toEqual([13, 14, 3]);
    expect(header.minLon).toBeCloseTo(1.3);
    expect(await archive.getMetadata()).toEqual({ name: 'test' });
  });

  // Fifty thousand tiles compressed one by one: some seconds on a busy CI machine.
  it('puts many tiles in leaf directories, the root still read first', async () => {
    const path = join(dir, 'many.pmtiles');
    const writer = await PmtilesWriter.create(path);
    // Uneven gaps and sizes, as real tiles have, so that the directory does not compress away.
    let seed = 42;
    const random = (below: number) => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed % below;
    };
    const ids: number[] = [];
    for (let index = 0, id = 1000; index < 50_000; index++, id += 1 + random(40)) {
      ids.push(id);
      await writer.add(id, gzipSync(new Uint8Array(1 + random(500)).fill(index % 251)));
    }
    // Tiles of every zoom, from 5 on.
    await writer.finish({ ...DESCRIPTION, minZoom: 0 });
    const archive = new PMTiles(inMemory(await readFile(path)));
    expect((await archive.getHeader()).leafDirectoryLength).toBeGreaterThan(0);
    for (const index of [0, 12_345, 49_999]) {
      const id = ids[index] ?? 0;
      const found = await archive.getZxy(...tileIdToZxy(id));
      expect(new Uint8Array(found?.data ?? new ArrayBuffer(0))[0]).toBe(index % 251);
    }
  }, 30_000);

  it('refuses a tile out of order', async () => {
    const writer = await PmtilesWriter.create(join(dir, 'bad.pmtiles'));
    await writer.add(10, new Uint8Array([1]));
    await expect(writer.add(5, new Uint8Array([1]))).rejects.toThrow();
  });
});
