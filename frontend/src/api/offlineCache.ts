/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The last-known-good copies of the few payloads a learner needs to keep playing with no
 * network: who they are, and what today's plan is.
 *
 * Only responses that have already been read successfully are stored, and they are only
 * ever read back when the server is *unreachable* — never to serve a stale plan over a
 * live one. A `/learning/today` payload carries its questions inline, so one cached course
 * plus the precached game bundles is a complete, playable session.
 *
 * Entries carry a version and a timestamp: a schema change invalidates them rather than
 * feeding an old shape into new code, and a plan more than a few days old is dropped so a
 * child who has been away for a week does not resume a stale day.
 */

const PREFIX = "koda_offline";
const VERSION = 2;
/** Beyond this a cached plan is more confusing than helpful. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  version: number;
  savedAt: number;
  data: T;
}

export interface CachedEntry<T> {
  data: T;
  /** Epoch ms of the read that produced this copy — the UI can say how old the plan is. */
  savedAt: number;
}

/** Absent in `tsx --test` (node) runs and in private modes that block storage. */
const storage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export const accountKey = () => `${PREFIX}:account`;
export const courseKey = (studentId: string) => `${PREFIX}:course:${studentId}`;
export const progressKey = (studentId: string) => `${PREFIX}:progress:${studentId}`;

export function writeCache<T>(key: string, data: T, now: number = Date.now()): void {
  const store = storage();
  if (!store) return;
  const envelope: Envelope<T> = { version: VERSION, savedAt: now, data };
  try {
    store.setItem(key, JSON.stringify(envelope));
  } catch {
    // A full or blocked store costs offline play, not the session in progress.
  }
}

export function readCache<T>(key: string, now: number = Date.now()): CachedEntry<T> | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (envelope?.version !== VERSION || typeof envelope.savedAt !== "number") {
      store.removeItem(key);
      return null;
    }
    if (now - envelope.savedAt > MAX_AGE_MS) {
      store.removeItem(key);
      return null;
    }
    return { data: envelope.data, savedAt: envelope.savedAt };
  } catch {
    store.removeItem(key); // Corrupt entry: drop it rather than crash the boot path.
    return null;
  }
}

export function clearCache(key: string): void {
  storage()?.removeItem(key);
}

/** Signing out must not leave the next person holding this child's plan. */
export function clearAllOfflineCache(): void {
  const store = storage();
  if (!store) return;
  // Indexed access rather than `Object.keys`: enumerating a Storage as a plain object is a
  // browser convenience, not part of the interface, and it silently found nothing to delete.
  // Walked backwards because each removal reindexes what is left.
  for (let index = store.length - 1; index >= 0; index--) {
    const key = store.key(index);
    if (key?.startsWith(`${PREFIX}:`)) store.removeItem(key);
  }
}
