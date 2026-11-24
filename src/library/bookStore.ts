/**
 * The shelf a device can play: the published books, or the bundled starters when there are none.
 *
 * Offline-first. Published books are kept on the device the moment they
 * arrive, and a refresh has a deadline; when it runs out, or the device is
 * offline, the shelf is whatever it held last time — never empty, never a
 * spinner. Starter books fill the shelf only while there are no published
 * books; once there are, the shelf is exactly what was published.
 *
 * Built for a big library on a slow line. A refresh asks for the shelf's index
 * first — each book's id and revision, a few bytes a book — and downloads only
 * the books that are new or changed, a hundred at a time. An unchanged shelf
 * costs one small request instead of every story again. The books are kept in
 * IndexedDB (`bulkStore`), not `localStorage`, whose ~5 MB is shared with the
 * whole app and would have stopped saving the shelf at a few hundred books.
 *
 * Books here are frozen revisions from the server; nothing on the device edits
 * them.
 */

import { useEffect, useSyncExternalStore } from "react";
import type { Passage } from "./data/passage";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { BATCH_MAX, fetchBooks, fetchPublished, fetchShelfIndex } from "./api";
import { ApiError } from "../lib/sync/api";
import { bulkGet, bulkSet } from "../lib/bulkStore";

const KEY = "koda_library_books_v1";
const listeners = new Set<() => void>();
let version = 0;
let inflight: Promise<void> | null = null;

const parse = (raw: string | null): Passage[] | null => {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Passage[]) : null;
  } catch {
    return null;
  }
};

/* A shelf saved before the bulk store is still in localStorage: read it now so
   the first screen has books, and move it across. */
const legacy = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const carried = legacy();
let published: Passage[] = parse(carried) ?? [];
/** Whether anything newer than the stored copy has been adopted yet. */
let fresh = false;
if (carried && published.length) void bulkSet(KEY, carried);

/* The stored copy arrives a moment after start. It only fills a gap: anything
   the server has already given is at least as new. */
void bulkGet(KEY).then((raw) => {
  if (fresh) return;
  const stored = parse(raw);
  if (!stored || !stored.length) return;
  published = stored;
  version++;
  listeners.forEach((l) => l());
});

function set(next: Passage[]) {
  published = next;
  fresh = true;
  // A full or blocked store keeps the in-memory shelf for this session.
  void bulkSet(KEY, JSON.stringify(next));
  version++;
  listeners.forEach((l) => l());
}

const sameShelf = (a: readonly Passage[], b: readonly Passage[]): boolean =>
  a.length === b.length && a.every((book, i) => book.id === b[i].id && book.rev === b[i].rev);

/**
 * Bring the shelf up to the server's index, downloading only the difference.
 *
 * A batch that fails keeps the older revision of its books where the device has
 * one, so a dropped connection halfway through never empties a shelf.
 */
async function sync(): Promise<void> {
  let index: { id: string; rev: number }[];
  try {
    index = await fetchShelfIndex();
  } catch (error) {
    // A server from before the index answers 404: take the whole shelf as before.
    if (error instanceof ApiError && error.status === 404) {
      set(await fetchPublished());
      return;
    }
    throw error;
  }

  const have = new Map(published.map((book) => [book.id, book]));
  const wanted = index.filter((entry) => have.get(entry.id)?.rev !== entry.rev).map((entry) => entry.id);
  const got = new Map<string, Passage>();
  for (let at = 0; at < wanted.length; at += BATCH_MAX) {
    try {
      for (const book of await fetchBooks(wanted.slice(at, at + BATCH_MAX))) got.set(book.id, book);
    } catch {
      /* this batch waits for the next refresh; older copies stand meanwhile */
    }
  }

  const next = index
    .map((entry) => got.get(entry.id) ?? have.get(entry.id))
    .filter((book): book is Passage => Boolean(book));
  if (!sameShelf(next, published)) set(next);
  else fresh = true;
}

export const BookStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  version: () => version,

  /**
   * The published books — or, on a device that has none yet (never online, or
   * nothing published), the starter books that ship in the app. Starters are a
   * floor for an empty shelf, not part of the catalog: once real books arrive
   * they step aside, so a library is exactly what its authors published and
   * nothing in it is undeletable from the Studio.
   */
  shelf(): Passage[] {
    return published.length ? [...published] : [...STARTER_PASSAGES];
  },

  /** Ask the server. Resolves either way; a failure keeps the shelf as it was. */
  refresh(): Promise<void> {
    if (!inflight) {
      inflight = sync()
        .catch(() => {
          /* offline or signed out: the stored shelf stands */
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  },

  /** For tests. */
  reset(books: Passage[] = []) {
    set(books);
  },
};

export function useShelf(): Passage[] {
  useSyncExternalStore(BookStore.subscribe, BookStore.version, BookStore.version);
  useEffect(() => {
    void BookStore.refresh();
  }, []);
  return BookStore.shelf();
}
