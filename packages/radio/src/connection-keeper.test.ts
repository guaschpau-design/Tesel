import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionKeeper, type OpenedRadio } from './connection-keeper.ts';

/** A connection in memory; the keeper only ever closes it. */
class Connection {
  close(): Promise<void> {
    return Promise.resolve();
  }
}

/** A keeper whose radio opens every time, counting the times it was opened. */
function keeper(): { keeper: ConnectionKeeper<Connection>; opens: () => number } {
  let opens = 0;
  const open = (): Promise<OpenedRadio<Connection>> => {
    opens++;
    return Promise.resolve({ connection: new Connection(), name: 'Radio A', reopen: open });
  };
  const kept = new ConnectionKeeper(open, { opened: () => undefined, released: () => undefined });
  return { keeper: kept, opens: () => opens };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('connection keeper', () => {
  it('waits longer each time a radio that opens drops again soon after', async () => {
    vi.useFakeTimers();
    const { keeper: kept, opens } = keeper();
    await kept.connect();
    kept.lost();
    await vi.advanceTimersByTimeAsync(1000);
    expect(opens()).toBe(2);
    kept.lost();
    await vi.advanceTimersByTimeAsync(1000);
    // Opened, then lost again at once: the next try waits twice as long.
    expect(opens()).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(opens()).toBe(3);
    kept.lost();
    await vi.advanceTimersByTimeAsync(3999);
    expect(opens()).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(opens()).toBe(4);
    await kept.disconnect();
  });

  it('tries again soon once a link that stayed up a while drops', async () => {
    vi.useFakeTimers();
    const { keeper: kept, opens } = keeper();
    await kept.connect();
    kept.lost();
    await vi.advanceTimersByTimeAsync(1000);
    kept.lost();
    await vi.advanceTimersByTimeAsync(2000);
    expect(opens()).toBe(3);
    // Up for a minute: healthy, so a drop now is tried again after the first pause.
    await vi.advanceTimersByTimeAsync(60_000);
    kept.lost();
    await vi.advanceTimersByTimeAsync(1000);
    expect(opens()).toBe(4);
    await kept.disconnect();
  });
});
