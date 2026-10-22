/**
 * What this child has played in Rebus Rush: the puzzles they have met (oldest
 * first) and how each one went.
 *
 * Kept on the device first, per learner (a family shares a tablet), and synced
 * as that child's `rebusPlay` document, so a new phone or a second tablet
 * carries on where they left off and "worked through everything" survives a
 * cleared browser. Reading and writing never throw.
 */

import { activeLearnerId } from "../lib/learning";
import { SyncEngine, storageKeyFor } from "../lib/sync";
import type { Results } from "./results";

export interface RebusPlay {
  seen: string[];
  results: Results;
}

/** Before syncing, every child on a device shared these two keys. */
const OLD_SEEN = "koda.rebus.seen";
const OLD_RESULTS = "koda.rebus.results.v1";

const keyFor = (learner: string) => storageKeyFor("rebusPlay", learner)!;

const oldJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clean = (value: unknown): RebusPlay => {
  const v = (value && typeof value === "object" ? value : {}) as Partial<RebusPlay>;
  const seen = Array.isArray(v.seen) ? v.seen.filter((id): id is string => typeof id === "string") : [];
  const raw = v.results && typeof v.results === "object" && !Array.isArray(v.results) ? v.results : {};
  const results = Object.fromEntries(
    Object.entries(raw).filter(([, r]) => !!r && typeof (r as { plays?: unknown }).plays === "number" && ["clean", "helped", "missed"].includes((r as { last?: string }).last ?? "")),
  ) as Results;
  return { seen, results };
};

export const loadPlay = (learner: string = activeLearnerId()): RebusPlay => {
  try {
    const raw = localStorage.getItem(keyFor(learner));
    if (raw) return clean(JSON.parse(raw));
    // Carry over what this device recorded before syncing existed, to the first child who plays.
    const old = clean({ seen: oldJson(OLD_SEEN), results: oldJson(OLD_RESULTS) });
    if (old.seen.length > 0 || Object.keys(old.results).length > 0) {
      localStorage.setItem(keyFor(learner), JSON.stringify(old));
      localStorage.removeItem(OLD_SEEN);
      localStorage.removeItem(OLD_RESULTS);
      SyncEngine.recordDoc("rebusPlay", learner, old as unknown as Record<string, unknown>, { learnerId: learner });
      return old;
    }
  } catch {
    /* fall through to a fresh start */
  }
  return { seen: [], results: {} };
};

export const savePlay = (play: RebusPlay, learner: string = activeLearnerId()): void => {
  try {
    localStorage.setItem(keyFor(learner), JSON.stringify(play));
  } catch {
    /* Not remembered this time; a puzzle may come round sooner than it should. */
  }
  SyncEngine.recordDoc("rebusPlay", learner, play as unknown as Record<string, unknown>, { learnerId: learner });
};
