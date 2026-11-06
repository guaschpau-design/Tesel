// Encrypted envelopes per group (docs/protocol.md §8), stored in SQLite through node:sqlite.
// The server never sees anything but group IDs, event keys and ciphertext. The same database keeps
// the daily figures of how much the server is used (usage.ts). The schema and its upgrades live in
// store-schema.ts.

import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

import { toBase64url } from '@tesel/protocol';

import { envelopeDigest, openSchema, transaction } from './store-schema.ts';

export interface StoredEnvelope {
  readonly cursor: number;
  readonly key: Uint8Array;
  readonly env: Uint8Array;
}

export interface AppendResult {
  readonly cursor: number;
  /** False if the group already had this very envelope under this key. */
  readonly isNew: boolean;
}

/** What a group keeps on the server, for its operator (store-admin.ts). */
export interface GroupUsage {
  /** The group ID, base64url. */
  readonly id: string;
  readonly envelopes: number;
  /** Bytes of its envelopes, without the keys and indexes stored beside them. */
  readonly bytes: number;
  readonly firstReceivedAt: number;
  readonly lastReceivedAt: number;
}

/** One day's figure of how much the server is used (usage.ts). */
export interface UsageRow {
  /** The day, YYYY-MM-DD. */
  readonly day: string;
  readonly metric: string;
  readonly value: number;
}

/** What the server holds now, for the usage page. */
export interface StoredTotals {
  readonly groups: number;
  readonly envelopes: number;
}

export interface StoreOptions {
  /**
   * How long a write waits for one of another process (store-admin.ts beside the server) to
   * finish before it fails; none by default, so the server answers at once.
   */
  readonly busyTimeoutMs?: number;
}

// Statements used in more than one place.
const STORE_ID = 'SELECT id FROM store_info';
const LAST_CURSOR = 'SELECT cursor FROM group_cursors WHERE group_id = ?';

export class EnvelopeStore {
  /** The store identity (§8), base64url: created with the database and kept in it. */
  readonly id: string;

  readonly #db: DatabaseSync;

  /** Statements prepared once, at first use, by their SQL. */
  readonly #statements = new Map<string, StatementSync>();

  /** `path` is a file, or `:memory:` for tests. */
  constructor(path: string, options: StoreOptions = {}) {
    this.#db = new DatabaseSync(path, { timeout: options.busyTimeoutMs ?? 0 });
    openSchema(this.#db);

    const info = this.#sql(STORE_ID).get();
    if (info === undefined) throw new Error('The database has no store identity');
    this.id = toBase64url(info['id'] as Uint8Array);
  }

  /**
   * Stores an envelope unless the group already has this very envelope under this key; a
   * different envelope under a known key is stored too (ADR-0045). What it reads to number the
   * envelope is read in the same transaction, so a group purged meanwhile by another process
   * cannot get a cursor it had.
   */
  append(group: Uint8Array, key: Uint8Array, env: Uint8Array, now: number): AppendResult {
    const digest = envelopeDigest(env);
    return transaction(this.#db, () => {
      const known = this.#sql(
        'SELECT cursor FROM envelopes WHERE group_id = ? AND event_key = ? AND digest = ?',
      ).get(group, key, digest);
      if (known !== undefined) return { cursor: Number(known['cursor']), isNew: false };
      // A group without a cursor row counts on from the highest cursor of forgotten groups.
      const last =
        this.#sql(LAST_CURSOR).get(group) ??
        this.#sql('SELECT pruned_cursor AS cursor FROM store_info').get();
      const cursor = Number(last?.['cursor'] ?? 0) + 1;
      this.#sql(
        'INSERT INTO envelopes (group_id, cursor, event_key, digest, envelope, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(group, cursor, key, digest, env, now);
      this.#sql(
        'INSERT INTO group_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
      ).run(group, cursor);
      return { cursor, isNew: true };
    });
  }

  /**
   * The highest cursor a group has had, or 0 for a group the store does not know: never seen, or
   * forgotten once all its envelopes expired. Cursors are never reused: a forgotten group seen
   * again counts on from above any cursor it had.
   */
  lastCursor(group: Uint8Array): number {
    return Number(this.#sql(LAST_CURSOR).get(group)?.['cursor'] ?? 0);
  }

  /** When the oldest envelope the group still has was received, or null if it has none. */
  firstReceivedAt(group: Uint8Array): number | null {
    const row = this.#sql(
      'SELECT received_at FROM envelopes WHERE group_id = ? ORDER BY cursor LIMIT 1',
    ).get(group);
    return row === undefined ? null : Number(row['received_at']);
  }

  /** Up to `limit` envelopes with a cursor greater than `cursor`, oldest first. */
  after(group: Uint8Array, cursor: number, limit: number): StoredEnvelope[] {
    return this.#sql(
      'SELECT cursor, event_key, envelope FROM envelopes WHERE group_id = ? AND cursor > ? ORDER BY cursor LIMIT ?',
    )
      .all(group, cursor, limit)
      .map(toStoredEnvelope);
  }

  /** Whether the database answers a query, for health reporting. */
  isAvailable(): boolean {
    try {
      return this.#sql(STORE_ID).get() !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Deletes envelopes received before `time`, the oldest first and at most `limit` of them (all
   * of them when it is negative, as SQLite's LIMIT takes it), and forgets the cursors of groups
   * left without envelopes; returns how many envelopes went. The space they took is given back to
   * the file system. A limit lets a long deletion go in short steps, with the server answering in
   * between.
   */
  deleteReceivedBefore(time: number, limit = -1): number {
    return this.#deleteAndForget(
      `DELETE FROM envelopes WHERE (group_id, cursor) IN
        (SELECT group_id, cursor FROM envelopes WHERE received_at < ? ORDER BY received_at LIMIT ?)
        RETURNING group_id`,
      time,
      limit,
    );
  }

  /**
   * Deletes up to `limit` of a group's envelopes, the oldest first, and forgets the group once it
   * has none; returns how many went. Its cursors are never reused, as for an expired group.
   */
  deleteGroup(group: Uint8Array, limit: number): number {
    return this.#deleteAndForget(
      `DELETE FROM envelopes WHERE (group_id, cursor) IN
        (SELECT group_id, cursor FROM envelopes WHERE group_id = ? ORDER BY cursor LIMIT ?)
        RETURNING group_id`,
      group,
      limit,
    );
  }

  /** The `limit` groups that take the most room, the largest first. */
  largestGroups(limit: number): GroupUsage[] {
    return this.#sql(
      `SELECT group_id, COUNT(*) AS envelopes, SUM(LENGTH(envelope)) AS bytes,
        MIN(received_at) AS first, MAX(received_at) AS last
        FROM envelopes GROUP BY group_id ORDER BY bytes DESC LIMIT ?`,
    )
      .all(limit)
      .map((row) => ({
        id: toBase64url(row['group_id'] as Uint8Array),
        envelopes: Number(row['envelopes']),
        bytes: Number(row['bytes']),
        firstReceivedAt: Number(row['first']),
        lastReceivedAt: Number(row['last']),
      }));
  }

  /** How many groups have envelopes on the server, and how many envelopes they have. */
  storedTotals(): StoredTotals {
    const groups = this.#sql('SELECT COUNT(*) AS n FROM group_cursors').get()?.['n'];
    const envelopes = this.#sql('SELECT COUNT(*) AS n FROM envelopes').get()?.['n'];
    return { groups: Number(groups ?? 0), envelopes: Number(envelopes ?? 0) };
  }

  /**
   * Adds a day's figures: `sums` to what the day already has, and `highs` where they are higher.
   * Days before `forgetBefore` are deleted in the same transaction.
   */
  addUsage(
    day: string,
    sums: ReadonlyMap<string, number>,
    highs: ReadonlyMap<string, number>,
    forgetBefore: string,
  ): void {
    transaction(this.#db, () => {
      const add = this.#sql(
        `INSERT INTO usage (day, metric, value) VALUES (?, ?, ?)
          ON CONFLICT (day, metric) DO UPDATE SET value = value + excluded.value`,
      );
      for (const [metric, value] of sums) add.run(day, metric, value);
      const raise = this.#sql(
        `INSERT INTO usage (day, metric, value) VALUES (?, ?, ?)
          ON CONFLICT (day, metric) DO UPDATE SET value = MAX(value, excluded.value)`,
      );
      for (const [metric, value] of highs) raise.run(day, metric, value);
      this.#sql('DELETE FROM usage WHERE day < ?').run(forgetBefore);
    });
  }

  /** Every figure from `day` on, oldest first. */
  usageSince(day: string): UsageRow[] {
    return this.#sql('SELECT day, metric, value FROM usage WHERE day >= ? ORDER BY day, metric')
      .all(day)
      .map((row) => ({
        day: String(row['day']),
        metric: String(row['metric']),
        value: Number(row['value']),
      }));
  }

  close(): void {
    this.#db.close();
  }

  /**
   * Runs a DELETE that returns the group of each envelope it deletes, then forgets those groups
   * that have none left: the highest cursor each reached becomes the one every forgotten group
   * counts on from, so a cursor is never reused. Only the groups it touched are looked at.
   */
  #deleteAndForget(deletion: string, ...parameters: SQLInputValue[]): number {
    const deleted = transaction(this.#db, () => {
      const rows = this.#sql(deletion).all(...parameters);
      const groups = new Map<string, Uint8Array>();
      for (const row of rows) {
        const group = row['group_id'] as Uint8Array;
        groups.set(toBase64url(group), group);
      }
      for (const group of groups.values()) {
        const left = this.#sql('SELECT 1 FROM envelopes WHERE group_id = ? LIMIT 1').get(group);
        if (left !== undefined) continue;
        this.#sql(
          `UPDATE store_info SET pruned_cursor = MAX(pruned_cursor,
            COALESCE((SELECT cursor FROM group_cursors WHERE group_id = ?), 0))`,
        ).run(group);
        this.#sql('DELETE FROM group_cursors WHERE group_id = ?').run(group);
      }
      return rows.length;
    });
    this.#db.exec('PRAGMA incremental_vacuum');
    return deleted;
  }

  #sql(text: string): StatementSync {
    let statement = this.#statements.get(text);
    if (statement === undefined) {
      statement = this.#db.prepare(text);
      this.#statements.set(text, statement);
    }
    return statement;
  }
}

function toStoredEnvelope(row: Record<string, unknown>): StoredEnvelope {
  return {
    cursor: Number(row['cursor']),
    key: new Uint8Array(row['event_key'] as Uint8Array),
    env: new Uint8Array(row['envelope'] as Uint8Array),
  };
}
