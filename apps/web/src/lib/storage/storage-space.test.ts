import { describe, expect, it, vi } from 'vitest';

import { makeRoomWith, withRoom } from './storage-space.svelte.ts';

const full = () => new DOMException('The storage is full', 'QuotaExceededError');

describe('room for the group log', () => {
  it('frees the tiles seen and writes again when the storage is full', async () => {
    const free = vi.fn(() => Promise.resolve());
    makeRoomWith(free);
    let tries = 0;
    const written = await withRoom(() =>
      ++tries === 1 ? Promise.reject(full()) : Promise.resolve('stored'),
    );
    expect(written).toBe('stored');
    expect(free).toHaveBeenCalledTimes(1);
  });

  it('passes on a failure that is not for lack of room, and one that stays', async () => {
    const free = vi.fn(() => Promise.resolve());
    makeRoomWith(free);
    await expect(withRoom(() => Promise.reject(new Error('closed')))).rejects.toThrow('closed');
    expect(free).not.toHaveBeenCalled();
    await expect(withRoom(() => Promise.reject(full()))).rejects.toThrow('full');
    expect(free).toHaveBeenCalledTimes(1);
  });
});
