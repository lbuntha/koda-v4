/**
 * Being away, and being told so kindly.
 *
 * The streak rule answers "how many days in a row?". This answers the question
 * a child actually arrives with after a gap — *how long has it been, and does
 * anybody mind?* — and it is deliberately a separate rule, because the answers
 * differ: a run that lapsed is worth nothing to the flame and is still the only
 * reason the app has anything to say when the child comes back.
 *
 * Derived, never written, and with no clock of its own — the same contract as
 * `streak.ts`, and for the same reason. Nothing runs overnight to mark somebody
 * absent, because a tablet in a drawer runs nothing at all.
 *
 * Three things it will not do, each of them a decision rather than an omission:
 *
 *   - **It never names a lost streak.** There is no `streakLost` on the view,
 *     so no screen can write "you lost your 9-day streak" without adding one
 *     first — which is the moment to argue about it. `docs/PUSH.md` §1 rules
 *     streak-panic out for notifications; a band on Home is not a notification,
 *     and it is not a loophole either.
 *   - **It says nothing when the family has switched streaks off.** Turning the
 *     flame off is a parent saying "do not make this about consecutive days",
 *     and "you have been away three days" is exactly that.
 *   - **It keeps nothing.** No "seen" flag, no dismissal, nothing to get stuck
 *     on. The band stands until the child finishes a round, and then the rule
 *     goes quiet on its own.
 */

import { useSyncExternalStore } from "react";

import { ChildSettingsAPI, type GoalCadence } from "./childSettings";
import { StreakAPI, dayKey, daysBetween, observeStreak, type StreakConfig } from "./streak";
import type { UserProgress } from "../types";

/**
 * What there is to say, if anything.
 *
 * `quiet` is a real answer and the common one: a child who practised today, a
 * child who has never practised yet, and a family who does not count days all
 * reach it by different routes and all want the same silence.
 */
export type AbsenceState = "quiet" | "due" | "away";

export interface AbsenceView {
  state: AbsenceState;
  /**
   * Whole days since the last practice. `0` when they practised today, and
   * when they have never practised at all — a learner who has not started has
   * not been away, and a band greeting them "back" would be its first lie.
   */
  daysAway: number;
  /** The live run, for a `due` line to name. Zero once it has lapsed. */
  streakDays: number;
  /** Whether `streakDays` counts days or weeks, so no screen has to ask. */
  cadence: GoalCadence;
}

const QUIET: Omit<AbsenceView, "cadence"> = { state: "quiet", daysAway: 0, streakDays: 0 };

/**
 * How long it has been, and whether that is worth a word.
 *
 * Two days is the threshold for saying anything at all, and it is the whole of
 * the tuning. One day away is normal life — a child who practised yesterday
 * and opens the app before school has missed nothing, and "it has been 1 day"
 * is a sentence that would make this app tiring to live with.
 *
 * The exception is a run that is genuinely owed something today, which is what
 * `due` is: `observeStreak` already decides that, including the grace days a
 * family has asked for, so this asks rather than working it out again.
 */
export const observeAbsence = (
  progress: UserProgress,
  config: StreakConfig,
  now: Date = new Date(),
  cadence: GoalCadence = "daily",
): AbsenceView => {
  if (!config.enabled) return { ...QUIET, cadence };

  const streak = observeStreak(progress, config, now, cadence);
  const last = progress.lastPracticeDay;
  if (last === null) return { ...QUIET, cadence };

  const daysAway = Math.max(0, daysBetween(last, dayKey(now, config.dayStartHour)));
  if (daysAway >= 2) return { state: "away", daysAway, streakDays: streak.days, cadence };

  /*
   * A live run, not yet kept today. Daily only, and that is not an oversight:
   * a weekly run is not owed anything on a Tuesday, so telling a family their
   * three-week streak is "waiting" every morning would be a deadline that does
   * not exist. They still get the `away` line once a gap is real.
   */
  if (cadence === "daily" && streak.atRisk && daysAway >= 1) {
    return { state: "due", daysAway, streakDays: streak.days, cadence };
  }

  return { ...QUIET, cadence };
};

/**
 * The absence as a component should print it.
 *
 * Subscribes to both stores for the reason `useStreak` does: the rule belongs
 * to the deployment and the cadence to this child, and a parent changing either
 * must repaint the band without a reload.
 */
export const useAbsence = (progress: UserProgress): AbsenceView => {
  useSyncExternalStore(StreakAPI.subscribe, StreakAPI.version);
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version);
  return observeAbsence(
    progress,
    StreakAPI.current(),
    new Date(),
    ChildSettingsAPI.current().goalCadence,
  );
};
