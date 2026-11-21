import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { CountryFile, CountryTable } from './countries.ts';

// As DB-IP writes it: a range a line, sorted, IPv4 first.
const CSV = `0.0.0.0,0.255.255.255,ZZ
2.136.0.0,2.143.255.255,ES
5.42.0.0,5.42.255.255,PT
2001:818::,2001:81f:ffff:ffff:ffff:ffff:ffff:ffff,PT
2a0c:5a80::,2a0c:5a87:ffff:ffff:ffff:ffff:ffff:ffff,ES
`;

const table = await CountryTable.read(() => CSV.split('\n'));

describe('CountryTable', () => {
  it('finds the country of an IPv4 address, plain or as IPv6 shows it', () => {
    expect(table.of('2.136.0.0')).toBe('ES');
    expect(table.of('2.140.12.34')).toBe('ES');
    expect(table.of('2.143.255.255')).toBe('ES');
    expect(table.of('::ffff:5.42.1.2')).toBe('PT');
  });

  it('finds the country of an IPv6 address by its network', () => {
    expect(table.of('2001:818:1234::7')).toBe('PT');
    expect(table.of('2a0c:5a85:aa:bb:cc:dd:ee:ff')).toBe('ES');
  });

  it('knows no country between ranges, in DB-IP’s "ZZ", or for what is no address', () => {
    expect(table.of('2.144.0.0')).toBeNull();
    expect(table.of('9.9.9.9')).toBeNull();
    expect(table.of('0.1.2.3')).toBeNull();
    expect(table.of('2a0d::1')).toBeNull();
    expect(table.of('::1')).toBeNull();
    expect(table.of('nonsense')).toBeNull();
  });

  it('takes DB-IP’s quoted fields too', async () => {
    const quoted = await CountryTable.read(() => ['"2.136.0.0","2.143.255.255","ES"']);
    expect(quoted.of('2.137.0.1')).toBe('ES');
  });

  it('refuses what is not a table of countries', async () => {
    await expect(CountryTable.read(() => ['<html>Not found</html>'])).rejects.toThrow(/Line 1/);
    await expect(CountryTable.read(() => ['2.136.0.0,nonsense,ES'])).rejects.toThrow(/Line 1/);
  });
});

describe('CountryFile', () => {
  let directory: string | undefined;
  afterEach(() => {
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  it('knows nothing without its file, reads it once there, and again when it changes', async () => {
    directory = mkdtempSync(join(tmpdir(), 'tesel-countries-'));
    const path = join(directory, 'countries.csv.gz');
    const file = new CountryFile(path);
    await file.refresh();
    expect(file.of('2.136.0.1')).toBeUndefined();

    writeFileSync(path, gzipSync(CSV));
    await file.refresh();
    expect(file.of('2.136.0.1')).toBe('ES');

    writeFileSync(path, gzipSync('2.136.0.0,2.143.255.255,FR\n'));
    utimesSync(path, new Date(), new Date(Date.now() + 60_000));
    await file.refresh();
    expect(file.of('2.136.0.1')).toBe('FR');

    // A broken download keeps what it had: not a table, or a zip cut short.
    writeFileSync(path, gzipSync('<html>Not found</html>'));
    utimesSync(path, new Date(), new Date(Date.now() + 120_000));
    await file.refresh();
    expect(file.of('2.136.0.1')).toBe('FR');
    writeFileSync(path, gzipSync(CSV).subarray(0, 40));
    utimesSync(path, new Date(), new Date(Date.now() + 180_000));
    await file.refresh();
    expect(file.of('2.136.0.1')).toBe('FR');
  });

  it('reads a large table as it is unzipped, letting the server answer meanwhile', async () => {
    directory = mkdtempSync(join(tmpdir(), 'tesel-countries-'));
    const path = join(directory, 'countries.csv.gz');
    const lines = Array.from({ length: 50_000 }, (_, index) => {
      const address = `10.${String(index >> 8)}.${String(index & 255)}`;
      return `${address}.0,${address}.255,${index === 45_000 ? 'PT' : 'ES'}`;
    });
    writeFileSync(path, gzipSync(lines.join('\n')));
    const file = new CountryFile(path);
    let pauses = 0;
    const counting = setInterval(() => pauses++, 0);
    await file.refresh();
    clearInterval(counting);
    expect(file.of('10.175.200.9')).toBe('PT');
    expect(file.of('10.1.2.3')).toBe('ES');
    expect(pauses).toBeGreaterThan(0);
  });
});
