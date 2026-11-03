import { describe, expect, it } from 'vitest';

import { UnreadBytes } from './unread-bytes.ts';

/** A socket that has left `bufferedAmount` bytes unread. */
function socket(bufferedAmount: number) {
  return {
    bufferedAmount,
    terminated: false,
    terminate() {
      this.terminated = true;
    },
  };
}

describe('unread bytes in all', () => {
  it('closes the clients that left the most while all together are over the cap', () => {
    const unread = new UnreadBytes(100);
    const sockets = [socket(10), socket(60), socket(30), socket(40), socket(0)];
    unread.check(sockets, 0);
    expect(sockets.map((s) => s.terminated)).toEqual([false, true, false, false, false]);
  });

  it('leaves everyone alone under the cap, and adds up at most once a second', () => {
    const unread = new UnreadBytes(100);
    const under = [socket(50), socket(50)];
    unread.check(under, 0);
    expect(under.some((s) => s.terminated)).toBe(false);
    const over = [socket(200)];
    unread.check(over, 999);
    expect(over[0]?.terminated).toBe(false);
    unread.check(over, 1000);
    expect(over[0]?.terminated).toBe(true);
  });
});
