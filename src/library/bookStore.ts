/**
 * The shelf a device can play: the published books, or the bundled starters when there are none.
 *
 * Offline-first. Published books are kept in localStorage the moment they
 * arrive, and a refresh has a deadline; when it runs out, or the device is
 * offline, the shelf is whatever it held last time — never empty, never a
 * spinner. Starter books fill the shelf only while there are no published
 * books; once there are, the shelf is exactly what was published.
 *
 * Books here are frozen revisions from the server; nothing on the device edits
 * them.
 */

import { useEffect, useSyncExternalStore } from "react";
import type { Passage } from "./data/passage";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { fetchPublished } from "./api";

const KEY = "koda_library_books_v1";
const listeners = new Set<() => void>();
let version = 0;
let published: Passage[] = read();
let inflight: Promise<void> | null = null;

function read(): Passage[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Passage[]) : [];
  } catch {
    return [];
  }
}

function set(next: Passage[]) {
  published = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a full disk keeps the in-memory shelf */
  }
  version++;
  listeners.forEach((l) => l());
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
      inflight = fetchPublished()
        .then((books) => set(books))
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
