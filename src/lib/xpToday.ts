import { localDayOf } from "./learning/learningLog";

/**
 * XP earned today, per learner.
 *
 * The profile keeps only the running total, so the day's share is counted here
 * as it is awarded. Local and per device on purpose: it is a cheer on the Today
 * card, not a record — the learning log stays the record.
 */

const keyFor = (learnerId: string) => `koda_xp_today_v1__${learnerId}`;
const listeners = new Set<() => void>();

interface Tally {
  day: string;
  xp: number;
}

const read = (learnerId: string): Tally | null => {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    return raw ? (JSON.parse(raw) as Tally) : null;
  } catch {
    return null;
  }
};

export const XpToday = {
  /** XP this learner earned on `day` (today by default). */
  get(learnerId: string, day: string = localDayOf(new Date())): number {
    const tally = read(learnerId);
    return tally && tally.day === day ? tally.xp : 0;
  },

  add(learnerId: string, xp: number, day: string = localDayOf(new Date())): void {
    if (!(xp > 0)) return;
    try {
      localStorage.setItem(keyFor(learnerId), JSON.stringify({ day, xp: XpToday.get(learnerId, day) + xp }));
    } catch {
      /* Storage full or blocked: the cheer is lost, the XP itself is not. */
    }
    listeners.forEach((fn) => fn());
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
