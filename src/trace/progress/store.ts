/**
 * Each learner's writing steps, kept on this device — offline first, like the
 * Library's progress. Per learner, because a family shares a tablet.
 * Reading and writing never throw: a blocked store gives a fresh start, never
 * a broken page. (Syncing to the server is Phase 5.)
 */

import { activeLearnerId } from "../../lib/learning";
import type { ItemProgress } from "./ladder";
import { initialProgress } from "./ladder";

type Store = Record<string, Record<string, ItemProgress>>;

const KEY = "koda_trace_progress_v1";
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
    /* storage full or blocked: practice still works */
  }
  version++;
  listeners.forEach((l) => l());
}

export const TraceProgress = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  version: () => version,

  get(itemId: string, learner = activeLearnerId()): ItemProgress {
    return read()[learner]?.[itemId] ?? initialProgress();
  },

  set(itemId: string, progress: ItemProgress, learner = activeLearnerId()) {
    const store = read();
    store[learner] = { ...(store[learner] ?? {}), [itemId]: progress };
    write(store);
  },
};
