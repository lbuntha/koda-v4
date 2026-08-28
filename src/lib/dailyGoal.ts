/**
 * How many rounds a day this learner is aiming for.
 *
 * Its own document rather than a field in the learner's record, because of who
 * sets it: a parent sets their child's goal from their own device, and that
 * device does not hold the child's XP, stars or streak. Writing the goal into
 * the progress record would mean sending a progress record — and a parent's
 * device has no truthful one to send.
 *
 * One document per learner, so the family's rights answer the question the
 * feature asks. `learner:update` is held by a parent (for the children under
 * them) and by a student (an older learner with their own sign-in and nobody
 * above them), and *not* by a child — whose goal is set for them, not by them.
 * The server checks the same right, and refuses a learner who names a key that
 * is not their own, so a student cannot reach across at a sibling's goal.
 */

import { SyncEngine, storageKeyFor } from "./sync";

/** What a learner aims for until somebody says otherwise. */
export const DAILY_GOAL_DEFAULT = 5;
/** One round is a goal; nothing is not. */
export const DAILY_GOAL_MIN = 1;
/** Twenty rounds is already a long afternoon — past this it is not a goal. */
export const DAILY_GOAL_MAX = 20;

/** Shared prefix of every learner's key, for the storage listener below. */
const BASE_KEY = "koda_daily_goal_v1";

const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

const clamp = (n: number): number =>
  Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, Math.round(n)));

const keyFor = (learnerId: string): string => storageKeyFor("goals", learnerId)!;

const read = (learnerId: string): number | null => {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    if (!raw) return null;
    const value = Number((JSON.parse(raw) as { dailyGoal?: unknown }).dailyGoal);
    return Number.isFinite(value) ? clamp(value) : null;
  } catch {
    return null;
  }
};

export const DailyGoalAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** This learner's goal, or the default nobody has changed. */
  for(learnerId: string): number {
    return read(learnerId) ?? DAILY_GOAL_DEFAULT;
  },

  /** Whether anyone has actually set one, as opposed to inheriting the default. */
  isSet(learnerId: string): boolean {
    return read(learnerId) !== null;
  },

  /**
   * Set a learner's goal, from whichever device is doing the setting.
   *
   * Keyed by the learner it is *for*, not by whoever is signed in — that is
   * what lets a parent set it for a child, and it is why the server checks
   * that a learner naming a key is naming their own.
   */
  set(learnerId: string, goal: number): void {
    const body = { dailyGoal: clamp(goal) };
    try {
      localStorage.setItem(keyFor(learnerId), JSON.stringify(body));
    } catch {
      // A blocked store costs this device the saved goal; the upload still
      // carries it to the learner's own device.
    }
    SyncEngine.recordDoc("goals", learnerId, body, { learnerId });
    notify();
  },
};

/**
 * A goal set on another device.
 *
 * `apply.ts` writes the learner's key and announces it, so a goal a parent
 * changes on their phone reaches the child's tablet by the path a second tab
 * already uses.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(`${BASE_KEY}__`)) return;
    notify();
  });
}
