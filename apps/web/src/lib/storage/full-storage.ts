// For tests: a database of the app that cannot store anything, as on a device with no room left.
// Reads work; every write is refused with the error browsers give for a full storage, so nothing a
// transaction would write is stored.

import { unwrap } from 'idb';

import type { AppDb } from './app-db.ts';

/** Makes `db` refuse every write until `room` is called. */
export function fillStorage(db: AppDb): { readonly room: () => void } {
  const transaction = db.transaction.bind(db);
  let isFull = true;
  db.transaction = ((...args: Parameters<AppDb['transaction']>) => {
    const tx = transaction(...args);
    if (isFull && args[1] === 'readwrite') refuseWrites(unwrap(tx));
    return tx;
  }) as AppDb['transaction'];
  return {
    room: () => {
      isFull = false;
    },
  };
}

function refuseWrites(tx: IDBTransaction): void {
  const refuse = (): never => {
    throw new DOMException('The storage is full', 'QuotaExceededError');
  };
  const objectStore = tx.objectStore.bind(tx);
  tx.objectStore = (name: string) =>
    Object.assign(objectStore(name), { put: refuse, delete: refuse });
}
