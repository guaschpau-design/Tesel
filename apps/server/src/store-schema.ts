// The envelope store's schema, and how a database written by an earlier version reaches it. The
// database records its schema version in `PRAGMA user_version`; each migration brings it from
// one version to the next inside a transaction, so a failed upgrade leaves it as it was.

import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { STORE_ID_SIZE } from '@tesel/protocol';

type Migration = (db: DatabaseSync) => void;

/** Migration `n` (from 0) brings a database from schema version `n` to `n + 1`. */
const MIGRATIONS: readonly Migration[] = [
  schemaBeforeVersions,
  distinctEnvelopesAndIdentity,
  withoutCommandPosts,
];

/** The value `PRAGMA auto_vacuum` reads when incremental vacuum is on. */
const AUTO_VACUUM_INCREMENTAL = 2;

/** SHA-256 of an envelope: what tells two envelopes pushed under one key apart (ADR-0045). */
export function envelopeDigest(envelope: Uint8Array): Uint8Array {
  return createHash('sha256').update(envelope).digest();
}

/**
 * Sets the connection's options and brings the schema up to date. Incremental vacuum can only be
 * chosen before the first table exists, or by rebuilding the file once, which older databases get.
 */
export function openSchema(db: DatabaseSync): void {
  db.exec('PRAGMA auto_vacuum = INCREMENTAL');
  if (pragma(db, 'auto_vacuum') !== AUTO_VACUUM_INCREMENTAL) db.exec('VACUUM');
  // FULL: a push is answered `stored` only once it is on the disk, so not even a power cut loses
  // an envelope the server acknowledged, or reuses its cursor under the same store identity
  // (ADR-0046). It costs each push one flush of the log (ADR-0107).
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL');
  const version = pragma(db, 'user_version');
  if (version > MIGRATIONS.length) {
    throw new Error(`The database has schema ${String(version)}, newer than this server knows`);
  }
  for (const [index, migration] of MIGRATIONS.entries()) {
    if (index < version) continue;
    transaction(db, () => {
      migration(db);
      db.exec(`PRAGMA user_version = ${String(index + 1)}`);
    });
  }
}

/** Runs `run` in a transaction: all of its changes are kept, or none if it throws. */
export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function pragma(db: DatabaseSync, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).get()?.[name] ?? 0);
}

/**
 * Version 1: the schema as it was before versions were recorded. Databases of that time are
 * completed where they lack something; the very first had no pending_up column and no cursors.
 */
function schemaBeforeVersions(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS envelopes (
      group_id    BLOB    NOT NULL,
      cursor      INTEGER NOT NULL,
      event_key   BLOB    NOT NULL,
      envelope    BLOB    NOT NULL,
      received_at INTEGER NOT NULL,
      pending_up  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, cursor),
      UNIQUE (group_id, event_key)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS envelopes_received_at ON envelopes (received_at);
    CREATE TABLE IF NOT EXISTS group_cursors (
      group_id BLOB    NOT NULL PRIMARY KEY,
      cursor   INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS upstream_cursors (
      group_id BLOB    NOT NULL PRIMARY KEY,
      cursor   INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);
  const columns = db.prepare('PRAGMA table_info(envelopes)').all();
  if (!columns.some((column) => column['name'] === 'pending_up')) {
    db.exec(`
      ALTER TABLE envelopes ADD COLUMN pending_up INTEGER NOT NULL DEFAULT 0;
      INSERT OR IGNORE INTO group_cursors (group_id, cursor)
        SELECT group_id, MAX(cursor) FROM envelopes GROUP BY group_id;
    `);
  }
}

/**
 * Version 2: every distinct envelope under a key is kept (ADR-0045), the store has an identity
 * (ADR-0046), and a command post remembers the identity of its upstream.
 */
function distinctEnvelopesAndIdentity(db: DatabaseSync): void {
  db.function('sha256', { deterministic: true }, (envelope) =>
    envelopeDigest(envelope as Uint8Array),
  );
  db.exec(`
    CREATE TABLE envelopes_v2 (
      group_id    BLOB    NOT NULL,
      cursor      INTEGER NOT NULL,
      event_key   BLOB    NOT NULL,
      digest      BLOB    NOT NULL,
      envelope    BLOB    NOT NULL,
      received_at INTEGER NOT NULL,
      -- 1 while the upstream of a command post lacked it (until version 3).
      pending_up  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, cursor),
      UNIQUE (group_id, event_key, digest)
    ) WITHOUT ROWID;
    INSERT INTO envelopes_v2
      SELECT group_id, cursor, event_key, sha256(envelope), envelope, received_at, pending_up
      FROM envelopes;
    DROP TABLE envelopes;
    ALTER TABLE envelopes_v2 RENAME TO envelopes;
    CREATE INDEX envelopes_received_at ON envelopes (received_at);
    CREATE INDEX envelopes_pending_up ON envelopes (group_id, cursor) WHERE pending_up = 1;

    -- The store identity of the upstream, as its synced message gives it.
    ALTER TABLE upstream_cursors ADD COLUMN store TEXT;

    -- One row: this store's identity, and the highest cursor of the groups whose cursors were
    -- dropped once all their envelopes had expired; a group seen again counts on from it.
    CREATE TABLE store_info (
      id            BLOB    NOT NULL,
      pruned_cursor INTEGER NOT NULL
    );
  `);
  db.prepare('INSERT INTO store_info (id, pruned_cursor) VALUES (?, 0)').run(
    randomBytes(STORE_ID_SIZE),
  );
}

/**
 * Version 3: servers no longer replicate one another (ADR-0058), so nothing is kept for an
 * upstream: what it lacked, and how far it had been read.
 */
function withoutCommandPosts(db: DatabaseSync): void {
  db.exec(`
    DROP INDEX envelopes_pending_up;
    ALTER TABLE envelopes DROP COLUMN pending_up;
    DROP TABLE upstream_cursors;
  `);
}
