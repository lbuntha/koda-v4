/**
 * Each learner's writing steps — kept on the device first (practice never
 * waits for the network) and synced as that child's `traceProgress` document,
 * so another tablet, and the parent report, see the same thing.
 *
 * Per learner, because a family shares a tablet. Reading and writing never
 * throw: a blocked store gives a fresh start, never a broken page.
 */

import { activeLearnerId } from "../../lib/learning";
import { SyncEngine, storageKeyFor } from "../../lib/sync";
import type { ItemProgress } from "./ladder";
import { initialProgress } from "./ladder";

type Record_ = Record<string, ItemProgress>;

/** Before syncing, every learner's progress shared one key on the device. */
const OLD_KEY = "koda_trace_progress_v1";
const PREFIX = "koda_trace_progress_v2";
const listeners = new Set<() => void>();
let version = 0;

const keyFor = (learner: string) => storageKeyFor("traceProgress", learner)!;

function read(learner: string): Record_ {
  try {
    const raw = localStorage.getItem(keyFor(learner));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record_;
    }
    // Carry over what this device recorded before syncing existed.
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "{}");
    const mine = old && typeof old === "object" ? old[learner] : null;
    if (mine && typeof mine === "object") {
      localStorage.setItem(keyFor(learner), JSON.stringify(mine));
      return mine as Record_;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function bump() {
  version++;
  listeners.forEach((l) => l());
}

// A pulled change from another device lands in storage; show it.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(PREFIX)) bump();
  });
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
    return read(learner)[itemId] ?? initialProgress();
  },

  all(learner = activeLearnerId()): Record_ {
    return read(learner);
  },

  set(itemId: string, progress: ItemProgress, learner = activeLearnerId()) {
    const record = { ...read(learner), [itemId]: progress };
    try {
      localStorage.setItem(keyFor(learner), JSON.stringify(record));
    } catch {
      /* storage full or blocked: practice still works */
    }
    SyncEngine.recordDoc("traceProgress", learner, record as unknown as Record<string, unknown>, { learnerId: learner });
    bump();
  },
};
