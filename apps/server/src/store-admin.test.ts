// The operator's commands, run as the operator runs them: a Node process on the server's database.

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { toBase64url } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { EnvelopeStore } from './envelope-store.ts';

const GROUP = new Uint8Array(16).fill(5);
const OTHER_GROUP = new Uint8Array(16).fill(6);
const key = (n: number) => new Uint8Array(16).fill(n);
const env = new Uint8Array(60);
const tempPath = () => join(mkdtempSync(join(tmpdir(), 'tesel-admin-')), 'tesel.db');

function admin(database: string, ...args: string[]): { status: number | null; output: string } {
  const run = spawnSync(
    process.execPath,
    ['--no-warnings', join(import.meta.dirname, 'store-admin.ts'), ...args],
    { env: { ...process.env, TESEL_DB: database }, encoding: 'utf8' },
  );
  return { status: run.status, output: run.stdout + run.stderr };
}

describe('store admin', () => {
  it('lists the largest groups, and purges one while the server keeps serving', () => {
    const database = tempPath();
    const server = new EnvelopeStore(database);
    for (let n = 1; n <= 3; n++) server.append(GROUP, key(n), env, 0);
    server.append(OTHER_GROUP, key(1), env, 0);

    const listed = admin(database, 'groups');
    expect(listed.status).toBe(0);
    const at = (group: Uint8Array) => listed.output.indexOf(toBase64url(group));
    expect(at(GROUP)).toBeGreaterThan(0);
    expect(at(GROUP)).toBeLessThan(at(OTHER_GROUP));

    const id = toBase64url(GROUP);
    expect(admin(database, 'purge', id)).toEqual({
      status: 0,
      output: `Deleted 3 envelopes of the group ${id}.\n`,
    });
    expect(server.after(GROUP, 0, 10)).toEqual([]);
    expect(server.after(OTHER_GROUP, 0, 10)).toHaveLength(1);
    expect(server.append(GROUP, key(4), env, 0).cursor).toBe(4);
    server.close();
  });

  it('says how it is used when it is not', () => {
    const database = tempPath();
    expect(admin(database, 'purge', 'not-a-group').status).toBe(2);
    expect(admin(database, 'groups', '0').status).toBe(2);
    expect(admin(database).output).toMatch(/usage/);
  });
});
