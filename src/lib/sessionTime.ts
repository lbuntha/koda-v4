import { useEffect, useState, useSyncExternalStore } from "react";

import { StreakAPI, dayKey } from "./streak";
import { currentLearnerId } from "./learnerProgress";
import { ChildSettingsAPI, type AllowedHours } from "./childSettings";

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

/**
 * Whether Koda is open at `now`. No window means always.
 *
 * The wall clock where the child is — `getHours()`, not the learning day — for
 * the reason `allowedHours` gives: a bedtime is what the clock in the hall says.
 *
 * Half-open, so `to` is the hour it shuts rather than the last hour allowed: at
 * 20 the window `{ from: 7, to: 20 }` is closed. A window whose `to` is at or
 * before its `from` wraps midnight, which is why this is not a single
 * comparison — 20 to 7 must be open at 23:00 and at 02:00 and shut at noon.
 */
export const withinAllowedHours = (
  hours: AllowedHours | null,
  now: Date = new Date(),
): boolean => {
  if (!hours) return true;
  const hour = now.getHours();
  return hours.from < hours.to
    ? hour >= hours.from && hour < hours.to
    : hour >= hours.from || hour < hours.to;
};

/** An hour as a child's grown-up would say it, for both screens that name one. */
export const hourLabel = (hour: number): string => {
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

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
export const TICK_MS = 15_000;

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

/**
 * Today's study time, as one reading.
 *
 * The parent's cap and the child's spent minutes live in two stores, on two
 * different schedules — the cap arrives by sync from a grown-up's phone, the
 * clock moves while a round runs — and the rule is the pair of them read
 * together. This is that reading, in one place, subscribed to both.
 *
 * A hook rather than four lines in `App`, because those four lines *were* the
 * rule and nothing could test them: they sat inside a component that mounts
 * sign-in, sync and the whole nav shell. Here the rule is reachable on its own.
 */
export interface StudyGate {
  /** Minutes a day the grown-up allowed, or `null` for no cap. */
  cap: number | null;
  /** Minutes played today, on this device. */
  spent: number;
  /** Minutes still available, or `null` when there is no cap. */
  left: number | null;
  /** Whether today's study time is spent, and a new round must be refused. */
  dayDone: boolean;
  /** The hours the grown-up opened, or `null` for any time of day. */
  hours: AllowedHours | null;
  /** Whether Koda is shut by the clock on the wall rather than by minutes spent. */
  outsideHours: boolean;
  /**
   * Whether a new round must be refused, for either reason.
   *
   * What the door asks. The two reasons stay separate beside it because the
   * child is told *which* — "you have had your twenty minutes" and "Koda is
   * asleep" are different sentences, and a screen that guessed would be wrong
   * half the time.
   */
  closed: boolean;
}

/**
 * The gate as it stands this instant, read fresh from both stores.
 *
 * Exists because a rendered value is the wrong thing to decide on. `dayDone`
 * moves when the clock ticks, which React hears about; `outsideHours` moves
 * when the hour changes, which nothing announces. A child sitting on the lesson
 * picker at 19:59 holds a render that said "open", and a cap read from that
 * render would let them start a round at 20:01. So the door reads this and the
 * screens read the hook.
 */
export const studyGateNow = (now: Date = new Date()): StudyGate => {
  const { sessionMinutes: cap, allowedHours: hours } = ChildSettingsAPI.current();
  const spent = SessionTimeAPI.spentToday(undefined, now);
  const dayDone = capReached(spent, cap);
  const outsideHours = !withinAllowedHours(hours, now);
  return {
    cap,
    spent,
    left: minutesLeft(spent, cap),
    dayDone,
    hours,
    outsideHours,
    closed: dayDone || outsideHours,
  };
};

export function useStudyGate(): StudyGate {
  // Both stores, because either one moving changes the answer: a parent
  // raising the cap from their phone must reopen the tab a child is sitting on.
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version);
  useSyncExternalStore(SessionTimeAPI.subscribe, SessionTimeAPI.version);

  /*
   * The third input, and the only one with nobody to subscribe to: the hour.
   *
   * Without this, bedtime arrives on a child's screen only when something else
   * happens to re-render it — so the picker they are staring at stays open past
   * eight, and they find out by tapping it. Better that the screen changes under
   * them than that the door does.
   *
   * Only while a window is actually set, so the families who never open this
   * setting pay nothing for it.
   */
  const hours = ChildSettingsAPI.current().allowedHours;
  // Depended on as a string, not the object: `current()` builds a fresh one
  // every render, so an object dep would restart the interval on each beat.
  const windowKey = hours ? `${hours.from}-${hours.to}` : "";
  const [, setBeat] = useState(0);
  useEffect(() => {
    if (!windowKey) return;
    let timer = 0;
    /*
     * Aimed at the turn of the hour rather than polling.
     *
     * The window only ever changes on the hour, so a 30-second interval would
     * re-render `App` a hundred and twenty times to catch one moment — on a
     * child's tablet, which is the device least able to spare it. A second past
     * the hour is late enough that `getHours()` has certainly moved.
     *
     * Rescheduled from inside, so a device that was asleep through the boundary
     * fires late, re-reads, and lines up again on the next one. Nothing about
     * the rule depends on this being punctual: the door reads the clock itself.
     */
    const schedule = () => {
      const now = new Date();
      const untilNextHour =
        (59 - now.getMinutes()) * 60_000 + (61 - now.getSeconds()) * 1_000;
      timer = window.setTimeout(() => {
        setBeat((beat) => beat + 1);
        schedule();
      }, untilNextHour);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [windowKey]);

  return studyGateNow();
}
