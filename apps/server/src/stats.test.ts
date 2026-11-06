import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EnvelopeStore } from './envelope-store.ts';
import { testServer } from './test-server.ts';
import { METRICS, Usage } from './usage.ts';

const KEY = 'a-long-enough-stats-key';
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

async function server(statsKey: string | null) {
  const root = mkdtempSync(join(tmpdir(), 'tesel-web-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Tesel</title>');
  const store = new EnvelopeStore(':memory:');
  const usage = new Usage(store);
  const { app } = await testServer({ app: { webRoot: root, usage, statsKey } });
  return { app, usage, store };
}

describe('the usage page', () => {
  it('is not there without a key', async () => {
    const { app } = await server(null);
    expect((await app.inject({ method: 'GET', url: '/stats' })).statusCode).toBe(404);
    await app.close();
  });

  it('asks for the key, and refuses a wrong one', async () => {
    const { app } = await server(KEY);
    const none = await app.inject({ method: 'GET', url: '/stats' });
    expect(none.statusCode).toBe(401);
    expect(none.headers['www-authenticate']).toContain('Basic');
    const wrong = await app.inject({
      method: 'GET',
      url: '/stats',
      headers: { authorization: basic('tesel', 'wrong') },
    });
    expect(wrong.statusCode).toBe(401);
    await app.close();
  });

  it('shows the page views it counted, in Spanish, with its styles', async () => {
    const { app } = await server(KEY);
    await app.inject({ method: 'GET', url: '/', headers: { 'user-agent': 'Mozilla/5.0' } });
    const authorization = basic('tesel', KEY);
    const page = await app.inject({ method: 'GET', url: '/stats', headers: { authorization } });
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body).toContain('Tesel · Uso');
    expect(page.body).toContain('Portada');
    expect(page.body).not.toContain('<script');
    expect(page.body).not.toContain('style=');
    const css = await app.inject({
      method: 'GET',
      url: '/stats/stats.css',
      headers: { authorization },
    });
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');
    await app.close();
  });

  it('counts pages of the site, not the usage page or missing pages', async () => {
    const { app, usage } = await server(KEY);
    const agent = { 'user-agent': 'Mozilla/5.0' };
    await app.inject({ method: 'GET', url: '/', headers: agent });
    await app.inject({ method: 'GET', url: '/missing', headers: agent });
    await app.inject({
      method: 'GET',
      url: '/stats',
      headers: { ...agent, authorization: basic('tesel', KEY) },
    });
    const views = usage.lastDays(1).filter((row) => row.metric.startsWith(METRICS.views));
    expect(views.map((row) => [row.metric, row.value])).toEqual([[`${METRICS.views}/`, 1]]);
    await app.close();
  });
});
