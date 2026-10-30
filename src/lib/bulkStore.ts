/**
 * Room for the big offline copies, so they cannot crowd out a child's progress.
 *
 * `localStorage` holds about 5 MB for the whole origin, and the Rebus puzzles,
 * the Trace shelf and the learning log all lived in it. The first two grow with
 * every set an author publishes; when the budget runs out `setItem` throws, and
 * the write that fails may be the one that records what a child just learned.
 * IndexedDB has room for hundreds of megabytes, so the bulk copies live there.
 *
 * Reading is asynchronous, so a store keeps whatever it already had in memory
 * and adopts the stored copy when it arrives. A device where IndexedDB is not
 * available (private windows in some browsers, tests) falls back to
 * `localStorage` and behaves as it always did.
 */

const DB = "koda-bulk";
const STORE = "kv";

let opened: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opened;
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = act(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The stored text for a key, or null. Never throws. */
export async function bulkGet(key: string): Promise<string | null> {
  const db = await open();
  try {
    if (db) {
      const value = await run(db, "readonly", (s) => s.get(key));
      return typeof value === "string" ? value : null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Keep `value` under `key`. Resolves true when it was kept somewhere.
 *
 * A copy moved into IndexedDB is removed from `localStorage`, which is the
 * space this exists to give back.
 */
export async function bulkSet(key: string, value: string): Promise<boolean> {
  const db = await open();
  try {
    if (db) {
      await run(db, "readwrite", (s) => s.put(value, key));
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to free */
      }
      return true;
    }
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Forget a key in both places. */
export async function bulkRemove(key: string): Promise<void> {
  const db = await open();
  try {
    if (db) await run(db, "readwrite", (s) => s.delete(key));
  } catch {
    /* already gone */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}
