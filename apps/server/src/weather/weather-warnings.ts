// Gathers the official weather warnings of some countries and keeps them ready to serve, as the
// JSON text of docs/protocol.md §8.2. Warnings are read every 10 minutes; region outlines are
// looked for once a day and downloaded only when MeteoAlarm publishes a new file, which is kept
// on disk with the time of the last look, so a restart does not download it again. Warnings that
// expire after a gathering are left out when serving, and a document gathered too long ago is not
// served at all.

import { writeFile } from 'node:fs/promises';

import {
  highestLevel,
  WEATHER_WARNINGS_KIND,
  WEATHER_WARNINGS_VERSION,
  type WarningRegion,
  type WeatherWarnings,
} from '@tesel/protocol';

import { getJson, readJsonFile } from './get-json.ts';
import { FEED_URLS, SOURCE, warningsByRegion } from './meteoalarm.ts';
import { listRepository, newestRegionsUrl, type Region, regionsOf } from './regions.ts';

const WARNINGS_EVERY_MS = 10 * 60 * 1000;
const REGIONS_EVERY_MS = 24 * 60 * 60 * 1000;
/** After outlines that could not be downloaded, how long until they are tried again. */
const REGIONS_RETRY_MS = 60 * 60 * 1000;
/** Far more than a country's warnings feed takes. */
const MAX_FEED_BYTES = 16 * 1024 * 1024;
/**
 * Room for MeteoAlarm's outlines of every region in Europe. Parsed, the file takes a few times
 * its size in memory, and the server has 512 MB (deploy/vps/compose.yaml).
 */
const MAX_OUTLINES_BYTES = 40 * 1024 * 1024;
/** The outlines of our countries only, rounded, as this server keeps them. */
const MAX_STORED_REGIONS_BYTES = 32 * 1024 * 1024;

export interface WeatherWarningsOptions {
  /** ISO codes of the countries to gather, among those of FEED_URLS. */
  readonly countries: readonly string[];
  /** Where the region outlines are kept between runs, or null to keep them in memory only. */
  readonly regionsFile: string | null;
  /** Warnings gathered longer ago than this are not served. */
  readonly maxAgeMinutes: number;
  /** Reads a JSON document of at most `maxBytes`; tests replace it. */
  readonly getJson?: (url: string, maxBytes: number) => Promise<unknown>;
  /** Milliseconds since the epoch. */
  readonly now?: () => number;
}

/**
 * What the outlines file on disk holds: the outlines, the URL and the countries they are of
 * (none yet before the first download ends), and when outlines were last looked for.
 */
interface StoredRegions {
  readonly source: string | null;
  readonly countries: readonly string[];
  readonly regions: readonly (readonly [string, Region])[];
  /** Milliseconds since the epoch; missing in files written before it was kept. */
  readonly checkedAt?: number;
}

/** The document as served: its JSON text, valid until the first of its warnings expires. */
interface Served {
  readonly body: string;
  /** Seconds since the epoch. */
  readonly until: number;
}

export class WeatherWarningsService {
  readonly #countries: readonly string[];
  readonly #regionsFile: string | null;
  readonly #maxAgeSeconds: number;
  readonly #getJson: (url: string, maxBytes: number) => Promise<unknown>;
  readonly #now: () => number;
  #regions = new Map<string, Region>();
  #regionsSource: string | null = null;
  #regionsCheckedAt = -Infinity;
  #document: WeatherWarnings | null = null;
  #served: Served | null = null;
  /** The steps whose last try failed. */
  readonly #failing = new Set<string>();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WeatherWarningsOptions) {
    this.#countries = options.countries;
    this.#regionsFile = options.regionsFile;
    this.#maxAgeSeconds = options.maxAgeMinutes * 60;
    this.#getJson = options.getJson ?? getJson;
    this.#now = options.now ?? Date.now;
  }

  /**
   * The §8.2 document as JSON text, with the warnings still in force; null until the first
   * gathering succeeds, and once the last success is older than the maximum age.
   */
  body(): string | null {
    const document = this.#document;
    if (document === null) return null;
    const now = Math.floor(this.#now() / 1000);
    if (now - document.updated > this.#maxAgeSeconds) return null;
    if (this.#served === null || now >= this.#served.until) this.#served = serve(document, now);
    return this.#served.body;
  }

  start(): void {
    void this.#loadStoredRegions().then(() => this.refresh());
    this.#timer = setInterval(() => void this.refresh(), WARNINGS_EVERY_MS);
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
  }

  /** Gathers again. A step that fails keeps what it had, and only its first failure is logged. */
  async refresh(): Promise<void> {
    if (this.#now() - this.#regionsCheckedAt >= REGIONS_EVERY_MS) {
      await this.#attempt('region outlines', () => this.#refreshRegions());
    }
    await this.#attempt('warnings', () => this.#refreshWarnings());
  }

  async #attempt(step: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
      this.#failing.delete(step);
    } catch (error) {
      if (!this.#failing.has(step)) console.warn(`Weather ${step} could not be gathered:`, error);
      this.#failing.add(step);
    }
  }

  async #refreshRegions(): Promise<void> {
    const url = newestRegionsUrl(await listRepository(this.#getJson));
    if (url === null) throw new Error('MeteoAlarm lists no region outlines');
    const checkedAt = this.#now();
    this.#regionsCheckedAt = checkedAt;
    if (url === this.#regionsSource) return;
    // Kept before downloading: a server that runs out of memory on the way and restarts must not
    // download again at once, and again, instead of serving.
    await this.#storeRegions();
    try {
      this.#regions = regionsOf(await this.#getJson(url, MAX_OUTLINES_BYTES), this.#countries);
    } catch (error) {
      // A download that failed, rather than one that took the server down, is tried again soon.
      this.#regionsCheckedAt = checkedAt - REGIONS_EVERY_MS + REGIONS_RETRY_MS;
      await this.#storeRegions();
      throw error;
    }
    this.#regionsSource = url;
    await this.#storeRegions();
  }

  async #refreshWarnings(): Promise<void> {
    // Without outlines every region would be left out, as if there were no warnings.
    if (this.#regions.size === 0) throw new Error('No region outlines yet');
    const now = Math.floor(this.#now() / 1000);
    const feeds = await Promise.all(
      this.#countries.flatMap((country) => {
        const url = FEED_URLS[country];
        return url === undefined ? [] : [this.#getJson(url, MAX_FEED_BYTES)];
      }),
    );
    const features: WarningRegion[] = [];
    for (const feed of feeds) {
      for (const [code, warnings] of warningsByRegion(feed, now)) {
        const region = this.#regions.get(code);
        if (region === undefined) continue;
        features.push({
          type: 'Feature',
          geometry: region.geometry,
          properties: { code, name: region.name, level: highestLevel(warnings), warnings },
        });
      }
    }
    this.#document = {
      type: 'FeatureCollection',
      tesel: WEATHER_WARNINGS_KIND,
      version: WEATHER_WARNINGS_VERSION,
      updated: now,
      source: SOURCE,
      features,
    };
    this.#served = null;
  }

  async #loadStoredRegions(): Promise<void> {
    if (this.#regionsFile === null) return;
    try {
      const stored = (await readJsonFile(
        this.#regionsFile,
        MAX_STORED_REGIONS_BYTES,
      )) as StoredRegions;
      if (stored.countries.join() !== this.#countries.join()) return;
      this.#regions = new Map(stored.regions);
      this.#regionsSource = stored.source;
      this.#regionsCheckedAt = stored.checkedAt ?? -Infinity;
    } catch {
      // None yet, too large or unreadable: the outlines are downloaded again.
    }
  }

  async #storeRegions(): Promise<void> {
    if (this.#regionsFile === null) return;
    const stored: StoredRegions = {
      source: this.#regionsSource,
      countries: this.#countries,
      regions: [...this.#regions],
      checkedAt: this.#regionsCheckedAt,
    };
    await writeFile(this.#regionsFile, JSON.stringify(stored));
  }
}

/** The document with only the warnings in force at `now` (seconds), as served until one expires. */
function serve(document: WeatherWarnings, now: number): Served {
  let until = Infinity;
  const features = document.features.flatMap((region) => {
    const warnings = region.properties.warnings.filter((warning) => warning.expires > now);
    if (warnings.length === 0) return [];
    for (const warning of warnings) until = Math.min(until, warning.expires);
    const properties = { ...region.properties, level: highestLevel(warnings), warnings };
    return [{ ...region, properties }];
  });
  return { body: JSON.stringify({ ...document, features }), until };
}
