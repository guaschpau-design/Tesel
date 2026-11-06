// Serving the landing page (/) and the web app (/app/) from the same origin as the relay: one
// server serves everything a phone needs. Each page it sends is counted (usage.ts).

import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

import { STATS_PATH } from './stats.ts';
import type { Usage } from './usage.ts';

/** Where the web app lives under the site (TESEL_BASE when it is built). */
const APP_PREFIX = '/app/';

export async function serveWeb(
  app: FastifyInstance,
  root: string,
  usage: Usage | null,
): Promise<void> {
  await app.register(fastifyStatic, { root, wildcard: false, cacheControl: false });

  if (usage !== null) {
    app.addHook('onResponse', async (request, reply) => {
      const type = String(reply.getHeader('content-type') ?? '');
      const path = (request.url.split('?')[0] ?? '').replace(/index\.html$/, '');
      if (request.method !== 'GET' || reply.statusCode !== 200 || !type.startsWith('text/html')) {
        return;
      }
      if (path.startsWith(STATS_PATH)) return;
      usage.pageView({
        path,
        host: request.hostname,
        referrer: request.headers.referer,
        address: request.ip,
        agent: request.headers['user-agent'],
      });
    });
  }

  // Built assets carry a content hash in their name; everything else must be revalidated so a
  // new release reaches phones at once. Routes that say how long to keep their answer keep it,
  // and what the handler below answers (redirects, the app's page, 404) is never an asset.
  app.addHook('onSend', async (request, reply) => {
    if (reply.hasHeader('Cache-Control')) return;
    reply.header(
      'Cache-Control',
      request.url.startsWith(`${APP_PREFIX}assets/`) && reply.statusCode < 400
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    );
  });

  app.setNotFoundHandler((request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    if (request.method === 'GET') {
      // Leading slashes collapse into one: "//en" is "/en", and redirecting it to "//en/" would
      // send the browser to another host.
      const path = (request.url.split('?')[0] ?? '').replace(/^\/+/, '/');
      // "/app" and "/en" mean their folders; relative links only work with the slash.
      if (!path.endsWith('/') && hasIndex(root, path)) return reply.redirect(`${path}/`, 301);
      // Any other page under the app (the invitation path /app/join among them) is the app.
      // A missing file (a map glyph range, say) is a 404, not the app's HTML in its place.
      if (path.startsWith(APP_PREFIX) && !extname(path)) {
        return reply.sendFile(join('app', 'index.html'));
      }
    }
    return reply.code(404).type('text/plain').send('Not found');
  });
}

function hasIndex(root: string, path: string): boolean {
  const base = resolve(root);
  const index = resolve(base, `.${path}`, 'index.html');
  return index.startsWith(base + sep) && existsSync(index);
}
