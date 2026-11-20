// Writes a PMTiles archive (version 3, https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md):
// tiles added in the order of their tile IDs, already compressed, are written to a scratch file as
// they come; once all are in, the header, the directories and the metadata are written ahead of
// them. The pmtiles package reads archives but does not write them.

import { createReadStream, createWriteStream } from 'node:fs';
import { open, rm, type FileHandle } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { gzipSync } from 'node:zlib';

const HEADER_BYTES = 127;
/** The header and the root directory must be read in one request of this size. */
const FIRST_REQUEST_BYTES = 16_384;
/** Entries per leaf directory to begin with, doubled until the root fits. */
const FIRST_LEAF_SIZE = 4096;
const GZIP = 2;
const MVT = 1;

interface Entry {
  readonly tileId: number;
  readonly offset: number;
  readonly length: number;
  /** Tiles from tileId on that share these bytes; 0 for a leaf directory. */
  readonly runLength: number;
}

export interface ArchiveDescription {
  readonly minZoom: number;
  readonly maxZoom: number;
  /** West, south, east, north. */
  readonly bounds: readonly [number, number, number, number];
  readonly centerZoom: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Appends a number as a varint: seven bits a byte, past the 32 bits bitwise arithmetic keeps. */
function writeVarint(bytes: number[], value: number): void {
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest % 0x80) + 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
}

/** A directory as the spec lays it out, compressed. */
function serializeDirectory(entries: readonly Entry[]): Uint8Array {
  const bytes: number[] = [];
  writeVarint(bytes, entries.length);
  let lastId = 0;
  for (const { tileId } of entries) {
    writeVarint(bytes, tileId - lastId);
    lastId = tileId;
  }
  for (const { runLength } of entries) writeVarint(bytes, runLength);
  for (const { length } of entries) writeVarint(bytes, length);
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    // Zero says "right after the previous one"; any other offset is written one more.
    const follows = previous !== undefined && entry.offset === previous.offset + previous.length;
    writeVarint(bytes, follows ? 0 : entry.offset + 1);
  });
  return gzipSync(Uint8Array.from(bytes));
}

/** The root directory, and leaf directories when the entries are too many for it alone. */
function directories(entries: readonly Entry[]): { root: Uint8Array; leaves: Uint8Array } {
  const rootRoom = FIRST_REQUEST_BYTES - HEADER_BYTES;
  const whole = serializeDirectory(entries);
  if (whole.length <= rootRoom) return { root: whole, leaves: new Uint8Array(0) };
  for (let leafSize = FIRST_LEAF_SIZE; ; leafSize *= 2) {
    const leafEntries: Entry[] = [];
    const leaves: Uint8Array[] = [];
    let offset = 0;
    for (let start = 0; start < entries.length; start += leafSize) {
      const chunk = entries.slice(start, start + leafSize);
      const leaf = serializeDirectory(chunk);
      leafEntries.push({
        tileId: chunk[0]?.tileId ?? 0,
        offset,
        length: leaf.length,
        runLength: 0,
      });
      leaves.push(leaf);
      offset += leaf.length;
    }
    const root = serializeDirectory(leafEntries);
    if (root.length <= rootRoom) return { root, leaves: Buffer.concat(leaves) };
  }
}

function header(fields: {
  root: number;
  metadata: number;
  leaves: number;
  data: number;
  tiles: number;
  description: ArchiveDescription;
}): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('PMTiles'), 0);
  bytes[7] = 3;
  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + fields.root;
  const leavesOffset = metadataOffset + fields.metadata;
  const dataOffset = leavesOffset + fields.leaves;
  const u64 = [
    rootOffset,
    fields.root,
    metadataOffset,
    fields.metadata,
    leavesOffset,
    fields.leaves,
    dataOffset,
    fields.data,
    // Addressed tiles, tile entries and distinct tile contents: one each, as no run is shared.
    fields.tiles,
    fields.tiles,
    fields.tiles,
  ];
  u64.forEach((value, index) => {
    view.setBigUint64(8 + index * 8, BigInt(value), true);
  });
  const { description } = fields;
  // Clustered: the tiles lie in the order of their IDs.
  bytes.set([1, GZIP, GZIP, MVT, description.minZoom, description.maxZoom], 96);
  const [west, south, east, north] = description.bounds;
  const e7 = (degrees: number) => Math.round(degrees * 1e7);
  view.setInt32(102, e7(west), true);
  view.setInt32(106, e7(south), true);
  view.setInt32(110, e7(east), true);
  view.setInt32(114, e7(north), true);
  bytes[118] = description.centerZoom;
  view.setInt32(119, e7((west + east) / 2), true);
  view.setInt32(123, e7((south + north) / 2), true);
  return bytes;
}

export class PmtilesWriter {
  readonly #path: string;
  readonly #scratchPath: string;
  readonly #scratch: FileHandle;
  readonly #entries: Entry[] = [];
  #offset = 0;

  private constructor(path: string, scratchPath: string, scratch: FileHandle) {
    this.#path = path;
    this.#scratchPath = scratchPath;
    this.#scratch = scratch;
  }

  /** Starts an archive to be written at `path`, its tiles kept meanwhile next to it. */
  static async create(path: string): Promise<PmtilesWriter> {
    const scratchPath = `${path}.tiles`;
    return new PmtilesWriter(path, scratchPath, await open(scratchPath, 'w'));
  }

  /** Adds a tile, gzip-compressed, after every tile already added: its ID must be higher. */
  async add(tileId: number, compressed: Uint8Array): Promise<void> {
    const last = this.#entries.at(-1);
    if (last !== undefined && tileId <= last.tileId) {
      throw new Error(`tile ${String(tileId)} added after tile ${String(last.tileId)}`);
    }
    await this.#scratch.write(compressed);
    this.#entries.push({ tileId, offset: this.#offset, length: compressed.length, runLength: 1 });
    this.#offset += compressed.length;
  }

  get tiles(): number {
    return this.#entries.length;
  }

  /** Writes the archive, and removes the tiles kept for it. */
  async finish(description: ArchiveDescription): Promise<void> {
    await this.#scratch.close();
    try {
      const { root, leaves } = directories(this.#entries);
      const metadata = gzipSync(new TextEncoder().encode(JSON.stringify(description.metadata)));
      const head = header({
        root: root.length,
        metadata: metadata.length,
        leaves: leaves.length,
        data: this.#offset,
        tiles: this.#entries.length,
        description,
      });
      const out = await open(this.#path, 'w');
      try {
        for (const part of [head, root, metadata, leaves]) await out.write(part);
      } finally {
        await out.close();
      }
      await pipeline(
        createReadStream(this.#scratchPath),
        createWriteStream(this.#path, { flags: 'a' }),
      );
    } finally {
      await rm(this.#scratchPath, { force: true });
    }
  }
}
