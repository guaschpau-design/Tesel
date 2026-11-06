// The usage page at /stats (ADR-0117), for whoever runs the server: behind HTTP basic
// authentication with the user `tesel` and TESEL_STATS_KEY as its password, and absent while that
// key is not set. Nothing it shows says who: see usage.ts.

import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { EnvelopeStore } from './envelope-store.ts';
import { STATS_CSS, STATS_DAYS, statsPage } from './stats-page.ts';
import type { Usage } from './usage.ts';

export const STATS_PATH = '/stats';
const STATS_USER = 'tesel';
const DAY_MS = 24 * 60 * 60 * 1000;

export function serveStats(
  app: FastifyInstance,
  store: Pick<EnvelopeStore, 'storedTotals'>,
  usage: Usage,
  key: string,
  now: () => number = Date.now,
): void {
  const expected = digest(`${STATS_USER}:${key}`);
  const allowed = (request: FastifyRequest, reply: FastifyReply): boolean => {
    void reply.header('Cache-Control', 'no-store');
    const header = request.headers.authorization ?? '';
    const given = header.startsWith('Basic ')
      ? Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8')
      : '';
    // Compared as digests of the same length, in constant time.
    if (timingSafeEqual(digest(given), expected)) return true;
    void reply
      .code(401)
      .header('WWW-Authenticate', 'Basic realm="Tesel", charset="UTF-8"')
      .type('text/plain')
      .send('Authentication required');
    return false;
  };

  app.get(STATS_PATH, (request, reply) => {
    if (!allowed(request, reply)) return reply;
    const days = Array.from({ length: STATS_DAYS }, (_, index) =>
      usage.dayOf(now() - (STATS_DAYS - 1 - index) * DAY_MS),
    );
    const html = statsPage({
      days,
      rows: usage.lastDays(STATS_DAYS),
      totals: store.storedTotals(),
    });
    return reply.type('text/html; charset=utf-8').send(html);
  });
  app.get(`${STATS_PATH}/stats.css`, (request, reply) => {
    if (!allowed(request, reply)) return reply;
    return reply.type('text/css; charset=utf-8').send(STATS_CSS);
  });
}

function digest(text: string): Buffer {
  return createHash('sha256').update(text).digest();
}
