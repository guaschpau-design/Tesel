import { afterEach, describe, expect, it, vi } from 'vitest';

import { webArchive } from './sources.ts';

const tile = webArchive(() => 'https://tiles.example/1/2/3');
const signal = new AbortController().signal;

function answer(status: number, type: string): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), { status, headers: { 'Content-Type': type } }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a web tile service', () => {
  it('gives the tile it sends', async () => {
    answer(200, 'image/jpeg');
    expect(await tile.getTile(1, 2, 3, signal)).toBeInstanceOf(ArrayBuffer);
  });

  it('has no tile where it says so with a client error', async () => {
    answer(404, 'text/html');
    expect(await tile.getTile(1, 2, 3, signal)).toBeUndefined();
  });

  it('fails, rather than keep it, on an error sent as text with a success status', async () => {
    answer(200, 'application/vnd.ogc.se_xml');
    await expect(tile.getTile(1, 2, 3, signal)).rejects.toThrow();
    answer(200, 'text/html; charset=utf-8');
    await expect(tile.getTile(1, 2, 3, signal)).rejects.toThrow();
  });
});
