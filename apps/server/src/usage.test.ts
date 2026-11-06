import { describe, expect, it } from 'vitest';

import { EnvelopeStore } from './envelope-store.ts';
import { METRICS, Usage, type PageRequest } from './usage.ts';

const NOON = Date.parse('2026-11-06T11:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const PHONE = 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile';

function page(overrides: Partial<PageRequest> = {}): PageRequest {
  return {
    path: '/',
    host: 'tesel.eu',
    referrer: undefined,
    address: '203.0.113.7',
    agent: PHONE,
    ...overrides,
  };
}

function setup(start = NOON) {
  const store = new EnvelopeStore(':memory:');
  let time = start;
  const usage = new Usage(store, { now: () => time });
  const figures = (day = '2026-11-06') =>
    Object.fromEntries(
      store
        .usageSince(day)
        .filter((row) => row.day === day)
        .map((row) => [row.metric, row.value]),
    );
  return {
    store,
    usage,
    figures,
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe('usage', () => {
  it('counts page views by page, the app’s pages as one, and robots apart', () => {
    const { usage, figures } = setup();
    usage.pageView(page());
    usage.pageView(page({ path: '/en/' }));
    usage.pageView(page({ path: '/app/' }));
    usage.pageView(page({ path: '/app/join' }));
    usage.pageView(page({ agent: 'Googlebot/2.1' }));
    usage.pageView(page({ agent: undefined }));
    usage.flush();
    expect(figures()).toMatchObject({
      [`${METRICS.views}/`]: 1,
      [`${METRICS.views}/en/`]: 1,
      [`${METRICS.views}/app/`]: 2,
      [METRICS.robots]: 2,
    });
  });

  it('counts each visitor once a day, and keeps nothing that says who', () => {
    const { store, usage, figures, later } = setup();
    usage.pageView(page());
    usage.pageView(page({ path: '/en/' }));
    usage.pageView(page({ address: '198.51.100.4' }));
    usage.flush();
    expect(figures()[METRICS.visitors]).toBe(2);
    const stored = JSON.stringify(store.usageSince('2000-01-01'));
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('Android');
    // The next day, the same visitor counts again.
    later(DAY_MS);
    usage.pageView(page());
    usage.flush();
    expect(figures('2026-11-07')[METRICS.visitors]).toBe(1);
  });

  it('names the site a visit came from, not its own pages, and no more than 50 a day', () => {
    const { usage, figures } = setup();
    usage.pageView(page({ referrer: 'https://www.google.com/' }));
    usage.pageView(page({ referrer: 'https://tesel.eu/en/' }));
    usage.pageView(page({ referrer: 'not a link' }));
    for (let index = 0; index < 60; index++) {
      usage.pageView(page({ referrer: `https://site${String(index)}.example/x?y=1` }));
    }
    usage.flush();
    const day = figures();
    expect(day[`${METRICS.from}google.com`]).toBe(1);
    expect(day[`${METRICS.from}tesel.eu`]).toBeUndefined();
    expect(Object.keys(day).filter((metric) => metric.startsWith(METRICS.from))).toHaveLength(51);
    expect(day[`${METRICS.from}other`]).toBe(11);
  });

  it('counts connections, the most at once, groups once a day and stored envelopes', () => {
    const { usage, figures } = setup();
    usage.connected();
    usage.connected();
    usage.disconnected();
    usage.connected();
    usage.joined('group-a');
    usage.joined('group-a');
    usage.joined('group-b');
    usage.stored(120);
    usage.stored(80);
    usage.flush();
    expect(figures()).toMatchObject({
      [METRICS.connections]: 3,
      [METRICS.peakConnections]: 2,
      [METRICS.groups]: 2,
      [METRICS.envelopes]: 2,
      [METRICS.bytes]: 200,
    });
    expect(JSON.stringify(figures())).not.toContain('group-a');
  });

  it('adds what each flush writes to the day, and counts days in Spain’s time', () => {
    const { usage, figures, later } = setup(Date.parse('2026-11-06T22:30:00Z'));
    usage.pageView(page());
    usage.flush();
    usage.pageView(page());
    usage.flush();
    // 23:30 in Madrid is still the 6th; half an hour later it is the 7th.
    expect(figures()[`${METRICS.views}/`]).toBe(2);
    later(60 * 60 * 1000);
    usage.pageView(page());
    expect(usage.lastDays(2).filter((row) => row.metric === `${METRICS.views}/`)).toEqual([
      { day: '2026-11-06', metric: `${METRICS.views}/`, value: 2 },
      { day: '2026-11-07', metric: `${METRICS.views}/`, value: 1 },
    ]);
  });
});
