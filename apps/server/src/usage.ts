// How much the site and the relay are used, counted per day and nothing more (ADR-0117): page
// views, visitors, which sites the visits come from (by name), connections to the relay, the
// groups that used it and the envelopes it stored. No address, browser or group is ever written
// down: visitors and groups are told apart in memory for one day, under a key drawn that day and
// never kept, and only how many there were is stored. The figures wait in memory and are written
// to the database every minute (`flush`).

import { createHash, randomBytes } from 'node:crypto';

import type { UsageRow } from './envelope-store.ts';

/** Where the figures are kept: the server's database (envelope-store.ts). */
export interface UsageStore {
  addUsage(
    day: string,
    sums: ReadonlyMap<string, number>,
    highs: ReadonlyMap<string, number>,
    forgetBefore: string,
  ): void;
  usageSince(day: string): UsageRow[];
}

/** What the relay tells (relay.ts). */
export interface RelayUsage {
  connected(): void;
  disconnected(): void;
  joined(group: string): void;
  stored(bytes: number): void;
}

/** A page request, as the web server sees it. */
export interface PageRequest {
  /** The page's path, such as `/` or `/en/`. */
  readonly path: string;
  /** The server's own host name: links from its own pages are not counted as coming from a site. */
  readonly host: string;
  readonly referrer: string | undefined;
  readonly address: string;
  readonly agent: string | undefined;
}

export interface UsageOptions {
  readonly now?: () => number;
  /** The time zone whose days the figures are counted in. */
  readonly timeZone?: string;
}

/** The figures' names, as stored. */
export const METRICS = {
  /** Page views of a path, such as `views:/en/`; the app's pages all count as `views:/app/`. */
  views: 'views:',
  /** Visits that came from a site, such as `from:google.com`. */
  from: 'from:',
  /** Different visitors that day. */
  visitors: 'visitors',
  /** Page views by crawlers and scripts, counted apart from people's. */
  robots: 'robots',
  /** Connections to the relay that day, and the most open at once. */
  connections: 'connections',
  peakConnections: 'peak-connections',
  /** Different groups that joined the relay that day. */
  groups: 'groups',
  /** Envelopes stored that day, and their bytes. */
  envelopes: 'envelopes',
  bytes: 'bytes',
} as const;

/** Figures are kept two years. */
const KEPT_DAYS = 730;
/** Different sites counted in a day; visits from more count as `from:other`. */
const MOST_SITES = 50;
/** Visitors and groups told apart in a day; past that the count stops growing, memory too. */
const MOST_TOLD_APART = 100_000;
const ROBOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|java\/|go-http|headless/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const APP_PREFIX = '/app/';

export class Usage implements RelayUsage {
  readonly #store: UsageStore;
  readonly #now: () => number;
  readonly #days: Intl.DateTimeFormat;
  #day: string;
  /** Drawn each day: what tells visitors apart cannot be matched across days. */
  #salt = randomBytes(16);
  readonly #visitors = new Set<string>();
  readonly #groups = new Set<string>();
  readonly #sites = new Set<string>();
  #open = 0;
  #sums = new Map<string, number>();
  #highs = new Map<string, number>();

  constructor(store: UsageStore, options: UsageOptions = {}) {
    this.#store = store;
    this.#now = options.now ?? Date.now;
    // en-CA writes dates as YYYY-MM-DD.
    this.#days = new Intl.DateTimeFormat('en-CA', {
      timeZone: options.timeZone ?? 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    this.#day = this.dayOf(this.#now());
  }

  /** The day of a time, YYYY-MM-DD, in the figures' time zone. */
  dayOf(time: number): string {
    return this.#days.format(time);
  }

  /** A page of the site or the app sent to a browser. */
  pageView(page: PageRequest): void {
    this.#roll();
    if (page.agent === undefined || ROBOT.test(page.agent)) {
      this.#add(METRICS.robots, 1);
      return;
    }
    const path = page.path.startsWith(APP_PREFIX) ? APP_PREFIX : page.path;
    this.#add(METRICS.views + path, 1);
    const visitor = createHash('sha256')
      .update(this.#salt)
      .update(`${page.address}\n${page.agent}`)
      .digest('base64url');
    this.#tellApart(this.#visitors, visitor, METRICS.visitors);
    const site = siteOf(page.referrer, page.host);
    if (site !== null) {
      if (this.#sites.size < MOST_SITES) this.#sites.add(site);
      this.#add(METRICS.from + (this.#sites.has(site) ? site : 'other'), 1);
    }
  }

  connected(): void {
    this.#roll();
    this.#open++;
    this.#add(METRICS.connections, 1);
    this.#raise(METRICS.peakConnections, this.#open);
  }

  disconnected(): void {
    this.#open = Math.max(0, this.#open - 1);
  }

  joined(group: string): void {
    this.#roll();
    this.#tellApart(this.#groups, group, METRICS.groups);
  }

  stored(bytes: number): void {
    this.#roll();
    this.#add(METRICS.envelopes, 1);
    this.#add(METRICS.bytes, bytes);
  }

  /** Writes what is waiting to the database. */
  flush(): void {
    this.#roll();
    this.#write();
  }

  /** The figures of the last `days` days, today's included, with what has not been written yet. */
  lastDays(days: number): UsageRow[] {
    this.flush();
    return this.#store.usageSince(this.dayOf(this.#now() - (days - 1) * DAY_MS));
  }

  /** On a new day, writes the last one's figures and starts counting afresh. */
  #roll(): void {
    const today = this.dayOf(this.#now());
    if (today === this.#day) return;
    this.#write();
    this.#day = today;
    this.#salt = randomBytes(16);
    this.#visitors.clear();
    this.#groups.clear();
    this.#sites.clear();
    // Connections still open are still open on the new day.
    if (this.#open > 0) this.#raise(METRICS.peakConnections, this.#open);
  }

  #write(): void {
    if (this.#sums.size === 0 && this.#highs.size === 0) return;
    const forgetBefore = this.dayOf(this.#now() - KEPT_DAYS * DAY_MS);
    this.#store.addUsage(this.#day, this.#sums, this.#highs, forgetBefore);
    this.#sums = new Map();
    this.#highs = new Map();
  }

  #tellApart(seen: Set<string>, key: string, metric: string): void {
    if (seen.size >= MOST_TOLD_APART || seen.has(key)) return;
    seen.add(key);
    this.#raise(metric, seen.size);
  }

  #add(metric: string, value: number): void {
    this.#sums.set(metric, (this.#sums.get(metric) ?? 0) + value);
  }

  #raise(metric: string, value: number): void {
    this.#highs.set(metric, Math.max(this.#highs.get(metric) ?? 0, value));
  }
}

/** The site a visit came from, by its host name without `www.`; null for none or for this one. */
function siteOf(referrer: string | undefined, ownHost: string): string | null {
  if (referrer === undefined || referrer === '') return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  const name = host.replace(/^www\./, '');
  const own = ownHost
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
  return name === '' || name === own ? null : name;
}
