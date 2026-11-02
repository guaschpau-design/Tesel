// Encrypted envelopes per group (docs/protocol.md §8), stored in SQLite through node:sqlite.
// The server never sees anything but group IDs, event keys and ciphertext. The schema and its
// upgrades live in store-schema.ts.

import { DatabaseSync, type StatementSync } from 'node:sqlite';

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

// Statements used in more than one place.
const STORE_INFO = 'SELECT id, pruned_cursor FROM store_info';
const LAST_CURSOR = 'SELECT cursor FROM group_cursors WHERE group_id = ?';

export class EnvelopeStore {
  /** The store identity (§8), base64url: created with the database and kept in it. */
  readonly id: string;

  readonly #db: DatabaseSync;
  /** The cursor a group without a cursor row counts on from (see store_info). */
  #prunedCursor: number;

  /** Statements prepared once, at first use, by their SQL. */
  readonly #statements = new Map<string, StatementSync>();

  /** `path` is a file, or `:memory:` for tests. */
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    openSchema(this.#db);

    const info = this.#sql(STORE_INFO).get();
    if (info === undefined) throw new Error('The database has no store identity');
    this.id = toBase64url(info['id'] as Uint8Array);
    this.#prunedCursor = Number(info['pruned_cursor']);
  }

  /**
   * Stores an envelope unless the group already has this very envelope under this key; a
   * different envelope under a known key is stored too (ADR-0045).
   */
  append(group: Uint8Array, key: Uint8Array, env: Uint8Array, now: number): AppendResult {
    const digest = envelopeDigest(env);
    const known = this.#sql(
      'SELECT cursor FROM envelopes WHERE group_id = ? AND event_key = ? AND digest = ?',
    ).get(group, key, digest);
    if (known !== undefined) return { cursor: Number(known['cursor']), isNew: false };
    const last = this.#sql(LAST_CURSOR).get(group);
    const cursor = (last === undefined ? this.#prunedCursor : Number(last['cursor'])) + 1;
    transaction(this.#db, () => {
      this.#sql(
        'INSERT INTO envelopes (group_id, cursor, event_key, digest, envelope, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(group, cursor, key, digest, env, now);
      this.#sql(
        'INSERT INTO group_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
      ).run(group, cursor);
    });
    return { cursor, isNew: true };
  }

  /**
   * The highest cursor a group has had, or 0 for a group the store does not know: never seen, or
   * forgotten once all its envelopes expired. Cursors are never reused: a forgotten group seen
   * again counts on from above any cursor it had.
   */
  lastCursor(group: Uint8Array): number {
    return Number(this.#sql(LAST_CURSOR).get(group)?.['cursor'] ?? 0);
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
      return this.#sql(STORE_INFO).get() !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Deletes envelopes received before `time`, the oldest first and at most `limit` of them (all
   * of them when it is negative, as SQLite's LIMIT takes it), and
   * forgets the cursors of groups left without envelopes; returns how many envelopes went. The
   * space they took is given back to the file system. A limit lets a long deletion go in short
   * steps, with the server answering in between.
   */
  deleteReceivedBefore(time: number, limit = -1): number {
    const deleted = transaction(this.#db, () => {
      const changes = Number(
        this.#sql(
          `DELETE FROM envelopes WHERE (group_id, cursor) IN
            (SELECT group_id, cursor FROM envelopes WHERE received_at < ?
              ORDER BY received_at LIMIT ?)`,
        ).run(time, limit).changes,
      );
      // Groups left without envelopes are forgotten; the cursor they reached is kept as the one
      // every forgotten group counts on from, so a cursor is never reused.
      this.#sql(
        `
        UPDATE store_info SET pruned_cursor = MAX(pruned_cursor, COALESCE(
          (SELECT MAX(cursor) FROM group_cursors AS g
            WHERE NOT EXISTS (SELECT 1 FROM envelopes AS e WHERE e.group_id = g.group_id)),
          0))
      `,
      ).run();
      this.#sql(
        'DELETE FROM group_cursors WHERE NOT EXISTS (SELECT 1 FROM envelopes AS e WHERE e.group_id = group_cursors.group_id)',
      ).run();
      return changes;
    });
    this.#prunedCursor = Number(
      this.#sql(STORE_INFO).get()?.['pruned_cursor'] ?? this.#prunedCursor,
    );
    this.#db.exec('PRAGMA incremental_vacuum');
    return deleted;
  }

  close(): void {
    this.#db.close();
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
