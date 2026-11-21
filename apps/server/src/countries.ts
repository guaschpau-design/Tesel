// Which country an address is in (ADR-0162), from DB-IP's free table of address ranges by
// country, which deploy/vps/countries.sh downloads every month. Used only to count visits and
// connections by country (usage.ts): the address is looked up and forgotten.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream';
import { createGunzip } from 'node:zlib';

/** DB-IP's code for addresses in no country: reserved, private or unassigned. */
const NO_COUNTRY = 'ZZ';
const COUNTRY_CODE = /^[A-Z]{2}$/;

/** Ranges of addresses, sorted, and the country of each. */
interface Ranges<T extends number | bigint> {
  readonly starts: ArrayLike<T>;
  readonly ends: ArrayLike<T>;
  readonly countries: Uint16Array;
}

/** DB-IP's table of address ranges by country, as it reads in memory. */
export class CountryTable {
  readonly #codes: readonly string[];
  readonly #v4: Ranges<number>;
  /** IPv6 by the network's first 64 bits: ranges smaller than that are too few to matter. */
  readonly #v6: Ranges<bigint>;

  private constructor(codes: readonly string[], v4: Ranges<number>, v6: Ranges<bigint>) {
    this.#codes = codes;
    this.#v4 = v4;
    this.#v6 = v6;
  }

  /**
   * Reads DB-IP's CSV, given as its lines: a range a line, its first and last address and its
   * country's code, sorted. Read twice, to count the ranges and then to keep them, so they go
   * straight into arrays of their size and reading takes little more memory than the table
   * itself. Throws on anything else, so a broken download is not taken for a table.
   */
  static async read(lines: () => AsyncIterable<string> | Iterable<string>): Promise<CountryTable> {
    const sizes = { v4: 0, v6: 0 };
    for await (const text of lines()) {
      if (text.trim() !== '') sizes[text.includes(':') ? 'v6' : 'v4']++;
    }
    const v4 = {
      starts: new Uint32Array(sizes.v4),
      ends: new Uint32Array(sizes.v4),
      countries: new Uint16Array(sizes.v4),
    };
    const v6 = {
      starts: new BigUint64Array(sizes.v6),
      ends: new BigUint64Array(sizes.v6),
      countries: new Uint16Array(sizes.v6),
    };
    const codes: string[] = [];
    const index = new Map<string, number>();
    const kept = { v4: 0, v6: 0 };
    let line = 0;
    for await (const text of lines()) {
      line++;
      if (text.trim() === '') continue;
      const [first = '', last = '', code = ''] = text
        .split(',')
        .map((field) => field.trim().replace(/^"|"$/g, ''));
      if (!COUNTRY_CODE.test(code)) throw new Error(`Line ${String(line)}: no country code`);
      let country = index.get(code);
      if (country === undefined) {
        country = codes.push(code) - 1;
        index.set(code, country);
      }
      if (isIPv4(first) && isIPv4(last) && kept.v4 < sizes.v4) {
        v4.starts[kept.v4] = ipv4(first);
        v4.ends[kept.v4] = ipv4(last);
        v4.countries[kept.v4++] = country;
      } else if (isIPv6(first) && isIPv6(last) && kept.v6 < sizes.v6) {
        v6.starts[kept.v6] = ipv6Network(first);
        v6.ends[kept.v6] = ipv6Network(last);
        v6.countries[kept.v6++] = country;
      } else {
        throw new Error(`Line ${String(line)}: not a range of addresses`);
      }
    }
    // A file replaced between the two readings.
    if (kept.v4 !== sizes.v4 || kept.v6 !== sizes.v6)
      throw new Error('The table changed as it was read');
    return new CountryTable(codes, v4, v6);
  }

  /** The code of the country `address` is in, such as ES, or null when it is in none or unknown. */
  of(address: string): string | null {
    // An IPv4 client of a server listening on IPv6 shows as ::ffff:1.2.3.4.
    const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
    let country: number | undefined;
    if (isIPv4(plain)) country = find(this.#v4, ipv4(plain));
    else if (isIPv6(plain)) country = find(this.#v6, ipv6Network(plain));
    const code = country === undefined ? undefined : this.#codes[country];
    return code === undefined || code === NO_COUNTRY ? null : code;
  }
}

/** The country of the range holding `value`, if one does. */
function find<T extends number | bigint>(ranges: Ranges<T>, value: T): number | undefined {
  // The last range that starts at or before the value.
  let low = 0;
  let high = ranges.starts.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const start = ranges.starts[middle];
    if (start !== undefined && start <= value) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const end = ranges.ends[found];
  return end !== undefined && value <= end ? ranges.countries[found] : undefined;
}

function ipv4(address: string): number {
  return address.split('.').reduce((value, part) => value * 256 + Number(part), 0);
}

/** An IPv6 address's first 64 bits: its network. */
function ipv6Network(address: string): bigint {
  const [head = '', tail] = address.split('::');
  const groups = (part: string) => (part === '' ? [] : part.split(':'));
  const before = groups(head);
  const after = tail === undefined ? [] : groups(tail);
  // An IPv4 address at the end takes two groups; it lies past the first 64 bits.
  const width = (parts: readonly string[]) =>
    parts.reduce((sum, part) => sum + (part.includes('.') ? 2 : 1), 0);
  const all = [...before, ...Array<string>(8 - width(before) - width(after)).fill('0'), ...after];
  return all
    .slice(0, 4)
    .reduce((value, group) => (value << 16n) | BigInt(Number.parseInt(group, 16)), 0n);
}

/**
 * The table in a file, gzipped as DB-IP publishes it, read again when the file changes (`refresh`,
 * called now and then). Without a file, or until one can be read, it knows no table.
 */
export class CountryFile {
  readonly #path: string;
  #table: CountryTable | null = null;
  #modified = 0;
  #reading = false;

  constructor(path: string) {
    this.#path = path;
  }

  /** The file's lines as it is unzipped; a broken file or zip ends them with its error. */
  #lines(): AsyncIterable<string> {
    const unzipped = pipeline(createReadStream(this.#path), createGunzip(), () => {
      // Its error reaches the lines read, which the reading throws.
    });
    return createInterface({ input: unzipped, crlfDelay: Infinity });
  }

  /** The country of `address` (CountryTable.of); undefined while there is no table. */
  of(address: string): string | null | undefined {
    return this.#table === null ? undefined : this.#table.of(address);
  }

  /**
   * Reads the file again if it changed since it was read, line by line as it is unzipped, so the
   * server goes on answering and its memory hardly grows. A broken file leaves the table as it was.
   */
  async refresh(): Promise<void> {
    if (this.#reading) return;
    this.#reading = true;
    try {
      const { mtimeMs } = await stat(this.#path);
      if (mtimeMs === this.#modified) return;
      this.#modified = mtimeMs;
      this.#table = await CountryTable.read(() => this.#lines());
    } catch (error) {
      // No file yet is no failure: the installer or its timer brings one.
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        console.error(`The countries in ${this.#path} could not be read:`, error);
      }
    } finally {
      this.#reading = false;
    }
  }
}
