import { useEffect } from "react";

import { StreakAPI, dayKey } from "./streak";
import { currentLearnerId } from "./learnerProgress";

/**
 * How long a child has been playing today.
 *
 * Kept here rather than on the progress record, and deliberately **not
 * synced**. Two reasons, and the second is the honest one:
 *
 * 1. It changes every few seconds while a round is running. Pushing that would
 *    make a document that exists to hold settings into a telemetry stream.
 * 2. It is therefore per device. A child with a tablet *and* a phone gets the
 *    cap twice over. That is a real hole and it is not worth closing with a
 *    per-minute upload — closing it properly means deriving playtime from the
 *    event stream server-side, which is a different piece of work.
 *
 * The day boundary is the streak's own, not midnight, so a household that has
 * moved `dayStartHour` to 4am gets one consistent idea of "today" across the
 * flame, the daily goal and the cap.
 */

const KEY = "koda_session_time_v1";

interface Tally {
  /** The learning day these seconds belong to. */
  day: string;
  seconds: number;
}

const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

const keyFor = (learnerId: string): string => `${KEY}__${learnerId}`;

const today = (now: Date = new Date()): string => dayKey(now, StreakAPI.current().dayStartHour);

const read = (learnerId: string, now: Date = new Date()): Tally => {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    const parsed = raw ? (JSON.parse(raw) as Partial<Tally>) : null;
    const day = today(now);
    // A tally from yesterday is not this day's, and reading it as such is how a
    // cap would still be spent when a child picks the tablet up in the morning.
    if (!parsed || parsed.day !== day) return { day, seconds: 0 };
    const seconds = Number(parsed.seconds);
    return { day, seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 };
  } catch {
    return { day: today(now), seconds: 0 };
  }
};

/** Whether a cap has been spent. `null` is no cap, and never reached. */
export const capReached = (spentMinutes: number, cap: number | null): boolean =>
  cap !== null && spentMinutes >= cap;

/** How long is left, in whole minutes. `null` when there is no cap. */
export const minutesLeft = (spentMinutes: number, cap: number | null): number | null =>
  cap === null ? null : Math.max(0, cap - spentMinutes);

export const SessionTimeAPI = {
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Minutes played today, rounded down — a part-minute has not been spent. */
  spentToday(learnerId: string = currentLearnerId(), now: Date = new Date()): number {
    return Math.floor(read(learnerId, now).seconds / 60);
  },

  /** Seconds played today, for a caller that needs the finer reading. */
  secondsToday(learnerId: string = currentLearnerId(), now: Date = new Date()): number {
    return read(learnerId, now).seconds;
  },

  /** Add time to today's tally. */
  record(seconds: number, learnerId: string = currentLearnerId(), now: Date = new Date()): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const tally = read(learnerId, now);
    const next: Tally = { day: tally.day, seconds: tally.seconds + Math.round(seconds) };
    try {
      localStorage.setItem(keyFor(learnerId), JSON.stringify(next));
    } catch {
      // An unwritable store means the cap does not hold on this device. The
      // round still runs; nothing about a child's play depends on this.
    }
    notify();
  },

  /** Give a child their day back. A parent's decision, never a child's. */
  reset(learnerId: string = currentLearnerId()): void {
    try {
      localStorage.removeItem(keyFor(learnerId));
    } catch {
      /* nothing to undo */
    }
    notify();
  },
};

/** How often the clock is written down while a round runs. */
const TICK_MS = 15_000;

/**
 * Count the time a round is open.
 *
 * Ticks rather than timing start-to-finish, so a tab left open on a finished
 * lesson does not bank an hour, and a child who closes the app mid-round has
 * still spent the minutes they actually played. The last part-tick is dropped,
 * which errs in the child's favour — the right direction for a limit.
 */
export function useSessionClock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const learnerId = currentLearnerId();
    const timer = window.setInterval(() => {
      // Only while the tab is actually in front of somebody: a backgrounded
      // tablet on a kitchen counter is not play.
      if (document.visibilityState === "visible") {
        SessionTimeAPI.record(TICK_MS / 1000, learnerId);
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [active]);
}
