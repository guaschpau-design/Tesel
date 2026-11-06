import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildApp } from './app.ts';
import { readConfig } from './config.ts';
import { DiskSpace } from './disk-space.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';
import { Usage } from './usage.ts';
import { WeatherWarningsService } from './weather/weather-warnings.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_SWEEP_MS = 60 * 60 * 1000;
/** How often the usage counted in memory is written to the database (usage.ts). */
const USAGE_FLUSH_MS = 60 * 1000;
/** Envelopes deleted at a time by the sweep, which lets the server answer between them. */
const SWEEP_BATCH = 5000;
/** Shutting down takes longer than this only if something hangs; the server stops anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000;
const MEGABYTE = 1024 * 1024;

const config = readConfig();
const inMemory = config.databasePath === ':memory:';
if (!inMemory) mkdirSync(dirname(config.databasePath), { recursive: true });
const store = new EnvelopeStore(config.databasePath);
const disk = inMemory
  ? null
  : new DiskSpace(dirname(config.databasePath), config.minFreeDiskMegabytes * MEGABYTE);
const usage = new Usage(store, { timeZone: config.timeZone });
const relay = new Relay(store, {
  limits: config.limits,
  hasRoom: () => disk?.hasRoom() ?? true,
  usage,
});
const weather =
  config.weatherCountries.length === 0
    ? null
    : new WeatherWarningsService({
        countries: config.weatherCountries,
        // The outlines are kept next to the database, so they survive the container.
        regionsFile: inMemory ? null : join(dirname(config.databasePath), 'weather-regions.json'),
        maxAgeMinutes: config.weatherMaxAgeMinutes,
      });
weather?.start();
const app = await buildApp(store, relay, { ...config, weather, usage });

/** Writes the usage counted so far; a busy or full database leaves it for the next time. */
function flushUsage(): void {
  try {
    usage.flush();
  } catch (error) {
    console.error('Usage could not be written:', error);
  }
}
const usageFlusher = setInterval(flushUsage, USAGE_FLUSH_MS);

let stopping = false;

/** Deletes the envelopes past their time, a batch at a time, until none is left or it stops. */
async function sweep(): Promise<void> {
  const before = Date.now() - config.retentionDays * DAY_MS;
  try {
    while (!stopping && store.deleteReceivedBefore(before, SWEEP_BATCH) === SWEEP_BATCH) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  } catch (error) {
    // A full disk or a busy database: the next sweep tries again.
    console.error('Old envelopes could not be deleted:', error);
  }
}
let sweeper: ReturnType<typeof setInterval> | undefined;

/** Stops everything once, however many signals or failures ask for it, and exits. */
function shutdown(exitCode: number): void {
  if (stopping) return;
  stopping = true;
  setTimeout(() => {
    console.error('Shutdown took too long; exiting');
    process.exit(exitCode === 0 ? 1 : exitCode);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  clearInterval(sweeper);
  clearInterval(usageFlusher);
  weather?.stop();
  app
    .close()
    .then(() => {
      flushUsage();
      store.close();
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      console.error('Shutdown failed:', error);
      process.exit(1);
    });
}
process.on('SIGTERM', () => {
  shutdown(0);
});
process.on('SIGINT', () => {
  shutdown(0);
});
// A bug must not leave the server half-working: it stops, and its supervisor starts it again.
process.on('uncaughtException', (error) => {
  console.error('Unexpected error:', error);
  shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unexpected rejection:', reason);
  shutdown(1);
});

try {
  await app.listen({ host: config.host, port: config.port });
  console.warn(`Tesel server listening on ${config.host}:${config.port}`);
  // Once the server answers, so that a long first sweep does not hold up its health check.
  void sweep();
  sweeper = setInterval(() => void sweep(), RETENTION_SWEEP_MS);
} catch (error) {
  console.error(error);
  process.exit(1);
}
