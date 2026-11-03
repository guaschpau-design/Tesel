// Server configuration, read once from the environment.

import { DEFAULT_LIMITS, LEAST_UNREAD_BYTES, type RelayLimits } from './relay-limits.ts';
import { FEED_URLS } from './weather/meteoalarm.ts';

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** SQLite database file. */
  readonly databasePath: string;
  /** Envelopes older than this are deleted. */
  readonly retentionDays: number;
  /** Directory with the landing page and the built web app under app/, or null to serve none. */
  readonly webRoot: string | null;
  /** Countries whose weather warnings it gathers (protocol §8.2); none turns them off. */
  readonly weatherCountries: readonly string[];
  /** Weather warnings gathered longer ago than this are no longer served. */
  readonly weatherMaxAgeMinutes: number;
  /** What one client, one address, one group and everyone together may ask of the relay. */
  readonly limits: RelayLimits;
  /** Pushes are refused while the database's disk has no more than this free. */
  readonly minFreeDiskMegabytes: number;
  /**
   * The reverse proxies whose X-Forwarded-For header is believed: addresses, ranges, or the
   * names `loopback`, `linklocal` and `uniquelocal` (private networks, Docker's among them). Only
   * loopback by default: a client that reaches the server from a private network directly could
   * otherwise name any address it likes, and dodge the limits per address.
   */
  readonly trustedProxies: readonly string[];
}

/**
 * Reads the settings. A setting left out and one set to nothing mean the same, its default: a
 * deployment can then pass every setting through, set or not. Lists say `none` (`off` for the
 * weather) to be empty.
 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: setting(env, 'TESEL_HOST') ?? '0.0.0.0',
    port: integer(env, 'TESEL_PORT', 8080, 1, 65535),
    databasePath: setting(env, 'TESEL_DB') ?? 'data/tesel.db',
    retentionDays: integer(env, 'TESEL_RETENTION_DAYS', 30, 1, 3650),
    webRoot: setting(env, 'TESEL_WEB_ROOT') ?? null,
    weatherCountries: countries(env, 'TESEL_WEATHER', 'ES,PT'),
    // Warnings are gathered every 10 minutes: an hour more of failures is tolerated.
    weatherMaxAgeMinutes: integer(env, 'TESEL_WEATHER_MAX_AGE_MINUTES', 70, 10, 7 * 24 * 60),
    limits: limits(env),
    minFreeDiskMegabytes: integer(env, 'TESEL_MIN_FREE_DISK_MB', 500, 0, 1_000_000),
    trustedProxies: list(env, 'TESEL_TRUSTED_PROXIES', 'loopback'),
  };
}

/** What clients may ask of the relay; what is not set here is DEFAULT_LIMITS'. */
function limits(env: NodeJS.ProcessEnv): RelayLimits {
  const value = (name: string, fallback: number) => integer(env, name, fallback, 1, 1_000_000);
  const relay: RelayLimits = {
    ...DEFAULT_LIMITS,
    maxConnections: value('TESEL_MAX_CONNECTIONS', DEFAULT_LIMITS.maxConnections),
    maxConnectionsPerAddress: value(
      'TESEL_MAX_CONNECTIONS_PER_IP',
      DEFAULT_LIMITS.maxConnectionsPerAddress,
    ),
    unreadMegabytes: value('TESEL_UNREAD_MB', DEFAULT_LIMITS.unreadMegabytes),
    newGroupsPerAddressPerHour: value(
      'TESEL_NEW_GROUPS_PER_IP_PER_HOUR',
      DEFAULT_LIMITS.newGroupsPerAddressPerHour,
    ),
    serverPerSecond: value('TESEL_PUSHES_PER_SECOND', DEFAULT_LIMITS.serverPerSecond),
    addressPerSecond: value('TESEL_PUSHES_PER_IP_PER_SECOND', DEFAULT_LIMITS.addressPerSecond),
    megabytesPerAddressPerDay: value(
      'TESEL_MB_PER_IP_PER_DAY',
      DEFAULT_LIMITS.megabytesPerAddressPerDay,
    ),
    megabytesPerGroupFirstDay: value(
      'TESEL_MB_PER_GROUP_FIRST_DAY',
      DEFAULT_LIMITS.megabytesPerGroupFirstDay,
    ),
  };
  // Each connection must be able to leave a few envelopes unread, even with all of them open.
  const most = Math.floor((relay.unreadMegabytes * 1024 * 1024) / LEAST_UNREAD_BYTES);
  if (relay.maxConnections > most) {
    throw new Error(
      `TESEL_MAX_CONNECTIONS may be at most ${String(most)} with TESEL_UNREAD_MB at ${String(relay.unreadMegabytes)}; raise it with the server's memory`,
    );
  }
  return relay;
}

/** A setting's text, or undefined when it is left out or set to nothing. */
function setting(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const text = env[name];
  return text === undefined || text === '' ? undefined : text;
}

/** A comma-separated list; `none` for an empty one. */
function list(env: NodeJS.ProcessEnv, name: string, fallback: string): string[] {
  const text = setting(env, name) ?? fallback;
  return text === 'none' ? [] : text.split(',').map((item) => item.trim());
}

/** A comma-separated list of country codes with a warnings feed; `off` for none. */
function countries(env: NodeJS.ProcessEnv, name: string, fallback: string): string[] {
  const text = setting(env, name) ?? fallback;
  if (text === 'off') return [];
  const codes = text.split(',').map((code) => code.trim().toUpperCase());
  const unknown = codes.filter((code) => !Object.hasOwn(FEED_URLS, code));
  if (unknown.length > 0) {
    const known = Object.keys(FEED_URLS).join(', ');
    throw new Error(`${name} takes country codes among ${known}, or off; got "${text}"`);
  }
  return codes;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const text = setting(env, name);
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}, got "${text}"`);
  }
  return value;
}
