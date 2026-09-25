/**
 * The shelf a device can play: bundled starter books plus published ones.
 *
 * Offline-first. Published books are kept in localStorage the moment they
 * arrive, and a refresh has a deadline; when it runs out, or the device is
 * offline, the shelf is whatever it held last time — never empty, never a
 * spinner. A published book with the same id as a starter book replaces it, so a
 * starter can be corrected without an app release.
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

  /** Starter books, overlaid by published ones with the same id, then the rest. */
  shelf(): Passage[] {
    const byId = new Map<string, Passage>(STARTER_PASSAGES.map((p) => [p.id, p]));
    for (const p of published) byId.set(p.id, p);
    return [...byId.values()];
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
