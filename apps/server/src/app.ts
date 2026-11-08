// Builds the HTTP application. Kept separate from main.ts so tests can run it in memory.

import fastifyWebsocket from '@fastify/websocket';
import {
  PROTOCOL_VERSION,
  RELAY_PATH,
  SERVER_INFO_PATH,
  WEATHER_WARNINGS_PATH,
  type ServerInfoBody,
} from '@tesel/protocol';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import type { EnvelopeStore } from './envelope-store.ts';
import { serveFloodZones } from './flood-zones.ts';
import { Heartbeat } from './heartbeat.ts';
import type { Relay } from './relay.ts';
import { serveStats } from './stats.ts';
import type { Usage } from './usage.ts';
import type { WeatherWarningsService } from './weather/weather-warnings.ts';
import { serveWeb } from './web.ts';
import { MAX_FRAME_BYTES } from './ws-text.ts';

export interface AppOptions {
  /** Directory to serve the landing page and the web app from, or null. */
  readonly webRoot: string | null;
  /** The weather warnings it serves (protocol §8.2), or null if it gathers none. */
  readonly weather: Pick<WeatherWarningsService, 'body'> | null;
  /**
   * Addresses of the reverse proxies in front of the server (Caddy in the deployments), whose
   * X-Forwarded-For header says which address a client connects from; empty for none.
   */
  readonly trustedProxies: readonly string[];
  /** Where page views are counted, or null to count none (ADR-0117). */
  readonly usage: Usage | null;
  /** The password of the usage page at /stats, or null for no page. */
  readonly statsKey: string | null;
  /** Whether it draws the flood zones of a view for the apps (protocol §8.3). */
  readonly floodZones: boolean;
}

export const NO_OPTIONS: AppOptions = {
  webRoot: null,
  weather: null,
  trustedProxies: [],
  usage: null,
  statsKey: null,
  floodZones: false,
};
/** Warnings are gathered every 10 minutes; browsers may keep them a little. */
const WEATHER_CACHE_CONTROL = 'public, max-age=300';
/** What a client refused for the server's connection limits is asked to wait. */
const RETRY_AFTER_SECONDS = 60;

export async function buildApp(
  store: EnvelopeStore,
  relay: Relay,
  options: AppOptions = NO_OPTIONS,
): Promise<FastifyInstance> {
  // Fastify's own log is off: it would record clients' addresses. Errors are logged below.
  const app = Fastify({
    logger: false,
    trustProxy: options.trustedProxies.length === 0 ? false : [...options.trustedProxies],
  });
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if ((error.statusCode ?? 500) >= 500) {
      console.error(`${request.method} ${request.routeOptions.url ?? '(no route)'} failed:`, error);
    }
    return reply.send(error);
  });
  await app.register(fastifyWebsocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  // Apps served from another origin read this too (protocol §8.1).
  app.get(`/${SERVER_INFO_PATH}`, (_request, reply) => {
    void reply.header('Access-Control-Allow-Origin', '*');
    if (!store.isAvailable()) return reply.code(503).send({ status: 'unavailable' });
    return {
      status: 'ok',
      protocolVersion: PROTOCOL_VERSION,
      time: Math.floor(Date.now() / 1000),
    } satisfies ServerInfoBody;
  });
  const { weather } = options;
  if (weather !== null) {
    app.get(`/${WEATHER_WARNINGS_PATH}`, (_request, reply) => {
      void reply.header('Access-Control-Allow-Origin', '*');
      const body = weather.body();
      if (body === null) return reply.code(503).type('text/plain').send('Not available');
      return reply
        .header('Cache-Control', WEATHER_CACHE_CONTROL)
        .type('application/json')
        .send(body);
    });
  }
  if (options.floodZones) serveFloodZones(app);
  if (options.usage !== null && options.statsKey !== null) {
    serveStats(app, store, options.usage, options.statsKey);
  }
  if (options.webRoot !== null) await serveWeb(app, options.webRoot, options.usage);

  const heartbeat = new Heartbeat();
  app.get(
    `/${RELAY_PATH}`,
    {
      websocket: true,
      // Refused before the upgrade, so a flood of connections costs as little as possible.
      preValidation: async (request, reply) => {
        if (!relay.admits(request.ip)) {
          await reply
            .code(503)
            .header('Retry-After', String(RETRY_AFTER_SECONDS))
            .type('text/plain')
            .send('Too many connections');
        }
      },
    },
    (socket, request) => {
      heartbeat.watch(socket);
      relay.accept(socket, request.ip);
    },
  );
  app.addHook('onClose', () => {
    heartbeat.stop();
  });

  return app;
}
