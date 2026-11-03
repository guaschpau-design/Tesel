import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';
import { DEFAULT_LIMITS } from './relay-limits.ts';

describe('configuration', () => {
  it('has defaults that work for a single server', () => {
    expect(readConfig({})).toEqual({
      host: '0.0.0.0',
      port: 8080,
      databasePath: 'data/tesel.db',
      retentionDays: 30,
      webRoot: null,
      weatherCountries: ['ES', 'PT'],
      weatherMaxAgeMinutes: 70,
      limits: DEFAULT_LIMITS,
      minFreeDiskMegabytes: 500,
      trustedProxies: ['loopback'],
    });
  });

  it('takes a setting set to nothing as left out, so a deployment can pass every one through', () => {
    const empty = Object.fromEntries(
      [
        'TESEL_HOST',
        'TESEL_PORT',
        'TESEL_DB',
        'TESEL_RETENTION_DAYS',
        'TESEL_WEB_ROOT',
        'TESEL_WEATHER',
        'TESEL_WEATHER_MAX_AGE_MINUTES',
        'TESEL_MAX_CONNECTIONS',
        'TESEL_MAX_CONNECTIONS_PER_IP',
        'TESEL_NEW_GROUPS_PER_IP_PER_HOUR',
        'TESEL_PUSHES_PER_SECOND',
        'TESEL_PUSHES_PER_IP_PER_SECOND',
        'TESEL_MB_PER_IP_PER_DAY',
        'TESEL_MB_PER_GROUP_FIRST_DAY',
        'TESEL_UNREAD_MB',
        'TESEL_MIN_FREE_DISK_MB',
        'TESEL_TRUSTED_PROXIES',
      ].map((name) => [name, '']),
    );
    expect(readConfig(empty)).toEqual(readConfig({}));
    expect(readConfig({ TESEL_TRUSTED_PROXIES: 'none' }).trustedProxies).toEqual([]);
  });

  it('reads the countries whose weather warnings it gathers', () => {
    expect(readConfig({ TESEL_WEATHER: 'es' }).weatherCountries).toEqual(['ES']);
    expect(readConfig({ TESEL_WEATHER: 'off' }).weatherCountries).toEqual([]);
    expect(() => readConfig({ TESEL_WEATHER: 'ES,XX' })).toThrow(/TESEL_WEATHER/);
  });

  it('reads the relay limits', () => {
    const config = readConfig({
      TESEL_MAX_CONNECTIONS: '50',
      TESEL_MAX_CONNECTIONS_PER_IP: '5',
      TESEL_NEW_GROUPS_PER_IP_PER_HOUR: '3',
      TESEL_PUSHES_PER_SECOND: '40',
      TESEL_PUSHES_PER_IP_PER_SECOND: '20',
      TESEL_MB_PER_IP_PER_DAY: '64',
      TESEL_MB_PER_GROUP_FIRST_DAY: '32',
      TESEL_UNREAD_MB: '8',
      TESEL_MIN_FREE_DISK_MB: '0',
      TESEL_TRUSTED_PROXIES: 'none',
    });
    expect(config.limits).toEqual({
      ...DEFAULT_LIMITS,
      maxConnections: 50,
      maxConnectionsPerAddress: 5,
      newGroupsPerAddressPerHour: 3,
      serverPerSecond: 40,
      addressPerSecond: 20,
      megabytesPerAddressPerDay: 64,
      megabytesPerGroupFirstDay: 32,
      unreadMegabytes: 8,
    });
    expect(config.minFreeDiskMegabytes).toBe(0);
    expect(config.trustedProxies).toEqual([]);
    expect(() => readConfig({ TESEL_MAX_CONNECTIONS: '0' })).toThrow(/TESEL_MAX_CONNECTIONS/);
    expect(() => readConfig({ TESEL_PUSHES_PER_IP_PER_SECOND: '0' })).toThrow(
      /TESEL_PUSHES_PER_IP_PER_SECOND/,
    );
  });

  it('refuses more connections than what clients may leave unread can be shared among', () => {
    // 96 MB shared out in parts of 8 KB.
    expect(readConfig({ TESEL_MAX_CONNECTIONS: '12288' }).limits.maxConnections).toBe(12_288);
    expect(() => readConfig({ TESEL_MAX_CONNECTIONS: '12289' })).toThrow(/TESEL_UNREAD_MB/);
    expect(readConfig({ TESEL_MAX_CONNECTIONS: '20000', TESEL_UNREAD_MB: '160' }).limits).toEqual({
      ...DEFAULT_LIMITS,
      maxConnections: 20_000,
      unreadMegabytes: 160,
    });
  });

  it('rejects an invalid port or retention', () => {
    expect(() => readConfig({ TESEL_PORT: 'eighty' })).toThrow(/TESEL_PORT/);
    expect(() => readConfig({ TESEL_RETENTION_DAYS: '0' })).toThrow(/TESEL_RETENTION_DAYS/);
  });
});
