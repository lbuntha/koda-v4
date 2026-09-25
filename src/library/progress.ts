/**
 * Which books a learner has opened and finished, kept on this device.
 *
 * Per learner, because a family shares a tablet: one child finishing a book must
 * not mark it finished for their sister. Per revision, because a book an admin
 * republishes with new questions is, for a child, a new book to finish.
 *
 * Reading and writing never throw. A private window or a full disk gives an empty
 * shelf, never a broken page.
 */

import { activeLearnerId } from "../lib/learning";

export type Stage = "read" | "quiz" | "done";

export interface BookProgress {
  stage: Stage;
  rev: number;
  /** Set when finished: questions right first time, and how many there were. */
  firstTry?: number;
  total?: number;
  stars?: number;
  updatedAt: number;
}

type Store = Record<string, Record<string, BookProgress>>;

const KEY = "koda_library_progress_v1";
const listeners = new Set<() => void>();
let version = 0;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: progress is a convenience, the book still plays */
  }
  version++;
  listeners.forEach((l) => l());
}

export const LibraryProgress = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  version: () => version,

  /** A book's progress for the current learner, or null if it is new to them — or was republished since. */
  get(bookId: string, rev: number, learner = activeLearnerId()): BookProgress | null {
    const p = read()[learner]?.[bookId];
    return p && p.rev === rev ? p : null;
  },

  set(bookId: string, patch: Omit<BookProgress, "updatedAt">, learner = activeLearnerId()) {
    const store = read();
    const mine = store[learner] ?? {};
    const prev = mine[bookId];
    // Never move a finished book backwards by opening it again.
    if (prev && prev.rev === patch.rev && prev.stage === "done" && patch.stage !== "done") return;
    store[learner] = { ...mine, [bookId]: { ...patch, updatedAt: Date.now() } };
    write(store);
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
    version++;
    listeners.forEach((l) => l());
  },
};
