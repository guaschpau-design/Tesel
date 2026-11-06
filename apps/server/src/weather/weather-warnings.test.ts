import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseWeatherWarnings } from '@tesel/protocol';
import { describe, expect, it, vi } from 'vitest';

import { buildApp, NO_OPTIONS } from '../app.ts';
import { EnvelopeStore } from '../envelope-store.ts';
import { Relay } from '../relay.ts';
import { FEED_URLS } from './meteoalarm.ts';
import { regionsListingUrl } from './regions.ts';
import { alert, feed, geocodes, listing, NOW_S } from './test-feeds.ts';
import { WeatherWarningsService } from './weather-warnings.ts';

/** MeteoAlarm as tests see it; counts what is asked of it. */
function meteoalarm(warnings = [alert({ identifier: 'a', region: 'ES521', level: 3 })]) {
  const asked: string[] = [];
  const getJson = (url: string) => {
    asked.push(url);
    if (url === regionsListingUrl(1)) return Promise.resolve(listing);
    if (url.includes('Geocodes')) return Promise.resolve(geocodes);
    if (url === FEED_URLS['ES']) return Promise.resolve(feed(...warnings));
    if (url === FEED_URLS['PT']) return Promise.resolve(feed());
    return Promise.reject(new Error(`unexpected ${url}`));
  };
  return { asked, getJson };
}

const now = () => NOW_S * 1000;
const MAX_AGE_MINUTES = 70;

describe('weather warnings service', () => {
  it('serves the warning regions as a §8.2 document', async () => {
    const service = new WeatherWarningsService({
      countries: ['ES', 'PT'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: meteoalarm().getJson,
      now,
    });
    expect(service.body()).toBeNull();
    await service.refresh();
    const document = parseWeatherWarnings(JSON.parse(service.body() ?? 'null'));
    expect(document?.updated).toBe(NOW_S);
    expect(document?.features.map((region) => region.properties)).toMatchObject([
      { code: 'ES521', name: 'Litoral sur de Valencia', level: 3 },
    ]);
  });

  it('downloads the outlines once, and keeps them on disk across restarts', async () => {
    const regionsFile = join(mkdtempSync(join(tmpdir(), 'tesel-weather-')), 'regions.json');
    const first = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: first.getJson,
      now,
    });
    await service.refresh();
    await service.refresh();
    expect(first.asked.filter((url) => url.includes('Geocodes'))).toHaveLength(1);

    const second = meteoalarm();
    const restarted = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: second.getJson,
      now,
    });
    restarted.start();
    restarted.stop();
    await expect.poll(() => restarted.body()).not.toBeNull();
    expect(second.asked.filter((url) => url.includes('Geocodes'))).toHaveLength(0);
  });

  it('does not download the outlines again on a restart after a download that never ended', async () => {
    const regionsFile = join(mkdtempSync(join(tmpdir(), 'tesel-weather-')), 'regions.json');
    const first = meteoalarm();
    let downloading = false;
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      // A server that runs out of memory on the way never sees the download end.
      getJson: (url) => {
        if (!url.includes('Geocodes')) return first.getJson(url);
        downloading = true;
        return new Promise(() => undefined);
      },
      now,
    });
    void service.refresh();
    await expect.poll(() => downloading).toBe(true);

    const second = meteoalarm();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const restarted = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: second.getJson,
      now,
    });
    restarted.start();
    restarted.stop();
    // Its first gathering has ended, well or not.
    await expect.poll(() => restarted.body() !== null || warn.mock.calls.length > 0).toBe(true);
    expect(second.asked.filter((url) => url.includes('Geocodes'))).toHaveLength(0);
    warn.mockRestore();
  });

  it('tries the outlines again within the hour after a download that failed', async () => {
    let time = now();
    let failing = true;
    const { asked, getJson } = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: (url) =>
        failing && url.includes('Geocodes')
          ? Promise.reject(new Error('connection reset'))
          : getJson(url),
      now: () => time,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await service.refresh();
    expect(service.body()).toBeNull();
    failing = false;
    time += 10 * 60 * 1000;
    await service.refresh();
    expect(service.body()).toBeNull();
    time += 60 * 60 * 1000;
    await service.refresh();
    expect(service.body()).not.toBeNull();
    expect(asked.filter((url) => url.includes('Geocodes'))).toHaveLength(1);
    warn.mockRestore();
  });

  it('keeps the last document when MeteoAlarm cannot be reached', async () => {
    let reachable = true;
    const { getJson } = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: (url) => (reachable ? getJson(url) : Promise.reject(new Error('offline'))),
      now,
    });
    await service.refresh();
    const body = service.body();
    reachable = false;
    await service.refresh();
    expect(service.body()).toBe(body);
  });

  it('leaves out warnings that expired since they were gathered', async () => {
    let time = NOW_S * 1000;
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: meteoalarm([
        alert({ identifier: 'a', region: 'ES521', level: 3, expiresInHours: 0.5 }),
        alert({ identifier: 'b', region: 'ES521', level: 2, expiresInHours: 6 }),
        alert({ identifier: 'c', region: 'PT004', level: 4, expiresInHours: 0.5 }),
      ]).getJson,
      now: () => time,
    });
    await service.refresh();
    const regions = () =>
      parseWeatherWarnings(JSON.parse(service.body() ?? 'null'))?.features.map(
        (region) => region.properties,
      );
    expect(regions()).toMatchObject([{ code: 'ES521', level: 3 }]);
    time += 45 * 60 * 1000;
    expect(regions()).toMatchObject([{ code: 'ES521', level: 2, warnings: [{ level: 2 }] }]);
  });

  it('stops serving warnings gathered too long ago', async () => {
    let time = NOW_S * 1000;
    let reachable = true;
    const { getJson } = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: (url) => (reachable ? getJson(url) : Promise.reject(new Error('offline'))),
      now: () => time,
    });
    await service.refresh();
    reachable = false;
    time += (MAX_AGE_MINUTES - 1) * 60 * 1000;
    expect(service.body()).not.toBeNull();
    time += 2 * 60 * 1000;
    expect(service.body()).toBeNull();
  });

  it('reads every page of the repository listing', async () => {
    const page = (n: number) =>
      Array.from({ length: 100 }, (_, i) => ({ path: `file-${String(n)}-${String(i)}.txt` }));
    const { getJson } = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: (url) => {
        if (url === regionsListingUrl(1)) return Promise.resolve(page(1));
        if (url === regionsListingUrl(2)) return Promise.resolve(listing);
        return getJson(url);
      },
      now,
    });
    await service.refresh();
    expect(service.body()).not.toBeNull();
  });

  it('gathers warnings with the outlines it has when the outlines cannot be checked', async () => {
    const regionsFile = join(mkdtempSync(join(tmpdir(), 'tesel-weather-')), 'regions.json');
    const first = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: meteoalarm().getJson,
      now,
    });
    await first.refresh();

    const { getJson } = meteoalarm();
    const restarted = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: (url) =>
        url === regionsListingUrl(1) ? Promise.reject(new Error('GitLab is down')) : getJson(url),
      now,
    });
    restarted.start();
    restarted.stop();
    await expect.poll(() => restarted.body()).not.toBeNull();
  });

  it('is served to any origin, and answers 503 until gathered and 404 when off', async () => {
    const store = new EnvelopeStore(':memory:');
    const relay = new Relay(store);
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      maxAgeMinutes: MAX_AGE_MINUTES,
      getJson: meteoalarm().getJson,
      now,
    });
    const app = await buildApp(store, relay, { ...NO_OPTIONS, weather: service });
    expect((await app.inject('/v1/weather-warnings')).statusCode).toBe(503);
    await service.refresh();
    const response = await app.inject('/v1/weather-warnings');
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(parseWeatherWarnings(response.json())?.features).toHaveLength(1);
    await app.close();

    const off = await buildApp(store, relay);
    expect((await off.inject('/v1/weather-warnings')).statusCode).toBe(404);
    await off.close();
  });
});
