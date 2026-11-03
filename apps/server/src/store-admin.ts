// The operator's commands on the server's database, run beside the server while it serves
// (deploy/vps/database.sh runs them in the server's image):
//
//   node src/store-admin.ts groups [N]     lists the N groups (20 by default) that take the most
//                                          room, with their envelopes, size and dates
//   node src/store-admin.ts purge GROUP    deletes every envelope of a group, given by its ID as
//                                          the list shows it, to rid the server of junk; its
//                                          cursors are never reused (ADR-0046)
//
// The database is the server's, TESEL_DB. A deletion goes in batches, and each waits for the
// server's own writes, so the server keeps answering; a push it cannot store meanwhile is
// answered `unavailable`, and its client tries again.

import { fromBase64url, GROUP_ID_SIZE } from '@tesel/protocol';

import { readConfig } from './config.ts';
import { EnvelopeStore } from './envelope-store.ts';

const DEFAULT_LISTED = 20;
/** Envelopes a purge deletes at a time, each time letting the server write in between. */
const PURGE_BATCH = 5000;
/** How long one of its writes waits for the server's. */
const BUSY_TIMEOUT_MS = 10_000;
const MEGABYTE = 1024 * 1024;

const USAGE = 'usage: store-admin.ts groups [N] | purge GROUP';

function main(args: readonly string[]): number {
  const [command, argument] = args;
  if (command === 'groups') {
    const count = argument === undefined ? DEFAULT_LISTED : Number(argument);
    if (!Number.isInteger(count) || count < 1) return usage();
    withStore((store) => {
      listGroups(store, count);
    });
    return 0;
  }
  if (command === 'purge' && argument !== undefined) {
    const group = groupId(argument);
    if (group === null) return usage();
    withStore((store) => {
      let deleted = 0;
      let batch: number;
      do {
        batch = store.deleteGroup(group, PURGE_BATCH);
        deleted += batch;
      } while (batch === PURGE_BATCH);
      print(`Deleted ${deleted} envelopes of the group ${argument}.`);
    });
    return 0;
  }
  return usage();
}

function listGroups(store: EnvelopeStore, count: number): void {
  print('GROUP                   ENVELOPES        MB  FIRST                 LAST');
  for (const group of store.largestGroups(count)) {
    print(
      [
        group.id,
        String(group.envelopes).padStart(10),
        (group.bytes / MEGABYTE).toFixed(1).padStart(9),
        ` ${utc(group.firstReceivedAt)}`,
        utc(group.lastReceivedAt),
      ].join('  '),
    );
  }
}

/** A group ID as the list shows it, or null if it is not one. */
function groupId(text: string): Uint8Array | null {
  const bytes = fromBase64url(text);
  return bytes?.length === GROUP_ID_SIZE ? bytes : null;
}

function withStore(run: (store: EnvelopeStore) => void): void {
  const store = new EnvelopeStore(readConfig().databasePath, { busyTimeoutMs: BUSY_TIMEOUT_MS });
  try {
    run(store);
  } finally {
    store.close();
  }
}

function utc(time: number): string {
  return new Date(time).toISOString().slice(0, 19).replace('T', ' ');
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

function usage(): number {
  console.error(USAGE);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
