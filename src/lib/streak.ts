/**
 * The learning streak: one day, one practice, one day added.
 *
 * The number on Home was React state that nothing ever wrote, so it read `0
 * days` for a child who had played every day that week. This is the rule behind
 * it, in one place, for the same reason scoring is: a streak is a shared reward,
 * earned across every skill, so no skill gets to define what a day of practice
 * means.
 *
 * Two halves, deliberately separate:
 *
 *   - `StreakAPI` — the rule, editable by an owner from Scoring & XP and
 *     shared by the whole family, like the XP rates it sits beside.
 *   - the pure functions — what a practice does to a learner's record, and what
 *     that record reads as today. No storage, no clock of their own; both are
 *     handed the config and the time, which is what makes a streak that breaks
 *     at midnight testable without waiting for midnight.
 *
 * A lapsed streak is *derived*, never written. Nothing runs at midnight to zero
 * anybody, because a tablet in a drawer runs nothing at all — `observeStreak`
 * decides what today's number is from the last day that counted, so a device
 * that was closed for a week agrees with one that was open.
 */

import { useSyncExternalStore } from "react";

import { saveDeploymentRule } from "./deploymentRules";
import { ChildSettingsAPI, type GoalCadence } from "./childSettings";
import type { UserProgress } from "../types";

export interface StreakConfig {
  /** Whether streaks are counted and shown at all. */
  enabled: boolean;
  /**
   * Finished rounds that make a day count.
   *
   * One by default: showing up is the habit being rewarded. A family that wants
   * the streak to mean real work raises it, and the day only lands once the
   * learner has done that many rounds.
   */
  roundsPerDay: number;
  /**
   * Missed days forgiven before the streak restarts.
   *
   * Zero is the strict reading — practise today or start again tomorrow. One
   * covers the Saturday nobody opened the app, which is the difference between
   * a streak a seven-year-old keeps and one they give up on in week two.
   */
  graceDays: number;
  /**
   * The hour a new day starts, 0–23, on the device's own clock.
   *
   * Midnight by default. A household whose bedtime routine runs past it sets
   * this to 3 or 4, so a 12:20am session still counts for the day it belongs
   * to rather than quietly starting a second one.
   */
  dayStartHour: number;
}

export const STREAK_DEFAULTS: StreakConfig = {
  enabled: true,
  roundsPerDay: 1,
  graceDays: 0,
  dayStartHour: 0,
};

const STORAGE_KEY = "koda_streak_v1";

const listeners = new Set<() => void>();
let version = 0;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Keeps a hand-edited or half-pulled document from producing an impossible rule. */
const sanitise = (raw: Partial<StreakConfig>): StreakConfig => ({
  enabled: raw.enabled !== false,
  // At least one: a day that needs no rounds would tick the streak up for
  // opening the app, which is not what the flame is claiming.
  roundsPerDay: clamp(Math.round(Number(raw.roundsPerDay ?? STREAK_DEFAULTS.roundsPerDay)), 1, 20),
  graceDays: clamp(Math.round(Number(raw.graceDays ?? STREAK_DEFAULTS.graceDays)), 0, 6),
  dayStartHour: clamp(Math.round(Number(raw.dayStartHour ?? STREAK_DEFAULTS.dayStartHour)), 0, 23),
});

const load = (): StreakConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitise(JSON.parse(raw) as Partial<StreakConfig>) : { ...STREAK_DEFAULTS };
  } catch {
    return { ...STREAK_DEFAULTS };
  }
};

let config: StreakConfig = load();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // One answer for the deployment: what keeps a streak alive is the
    // operator's call, and it is the same call on every child's device.
    void saveDeploymentRule("streak", config);
  } catch {
    // A blocked store costs this device the saved rule and nothing else — the
    // values still apply for this session.
  }
  version += 1;
  for (const cb of listeners) cb();
};

export const StreakAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The rule in force. Read fresh — never cache these. */
  current(): StreakConfig {
    return config;
  },

  update(patch: Partial<StreakConfig>): void {
    config = sanitise({ ...config, ...patch });
    persist();
  },

  isEdited(): boolean {
    return (Object.keys(STREAK_DEFAULTS) as (keyof StreakConfig)[]).some(
      (k) => config[k] !== STREAK_DEFAULTS[k],
    );
  },

  reset(): void {
    config = { ...STREAK_DEFAULTS };
    persist();
  },
};

/**
 * The rule as another device saved it.
 *
 * `apply.ts` writes the key and fires a `storage` event for every synced kind,
 * so a parent raising the daily requirement on their laptop reaches this device
 * by the path a second tab already used.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    config = load();
    version += 1;
    for (const cb of listeners) cb();
  });
}

/* ------------------------------------------------------------------ *
 * The rule itself. Pure: same record, same config, same clock reading,
 * same answer — which is the only way a day-boundary rule gets tested.
 * ------------------------------------------------------------------ */

/**
 * Which learning day a moment belongs to, as `YYYY-MM-DD`.
 *
 * A plain date is not enough. With `dayStartHour` at 4, everything before 4am
 * is still yesterday's practice, so the timestamp is wound back that far and
 * *then* asked what day it is. Local time throughout: a streak is about the
 * child's evenings, not UTC's.
 */
export const dayKey = (at: Date, dayStartHour: number): string => {
  const shifted = new Date(at.getTime() - dayStartHour * 60 * 60 * 1000);
  const month = `${shifted.getMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getDate()}`.padStart(2, "0");
  return `${shifted.getFullYear()}-${month}-${day}`;
};

/** Whole days from one day key to another. Negative if `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** How many days one period of the run covers. */
const periodDays = (cadence: GoalCadence): number => (cadence === "weekly" ? 7 : 1);

/**
 * The key a run is counted against.
 *
 * Daily, that is the learning day. Weekly, it is the Monday that day belongs
 * to — still a date, so every comparison below keeps working unchanged and the
 * whole difference between the two cadences is this one function.
 *
 * Weekly is not a softer daily. It is the same reward for a household that does
 * not practise every day: a child who plays once between Monday and Sunday
 * keeps their run, so a busy Tuesday costs nothing.
 */
export const periodKey = (
  at: Date,
  config: StreakConfig,
  cadence: GoalCadence = "daily",
): string => {
  const day = dayKey(at, config.dayStartHour);
  if (cadence !== "weekly") return day;
  const date = new Date(`${day}T00:00:00Z`);
  // ISO weeks start on Monday; `getUTCDay()` calls Sunday 0, so it winds back 6.
  const backToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - backToMonday);
  return date.toISOString().slice(0, 10);
};

/** Whether a streak last counted at `since` is still running at `now`. */
const stillRunning = (
  since: string,
  now: string,
  config: StreakConfig,
  cadence: GoalCadence = "daily",
): boolean => {
  const gap = daysBetween(since, now);
  // `graceDays + 1` periods: the period before this one is never a miss, so one
  // forgiven period means a gap of two still continues the run.
  return gap >= 0 && gap <= periodDays(cadence) * (config.graceDays + 1);
};

/** What a learner's streak reads as right now, without writing anything. */
export interface StreakView {
  /** Days to print. Zero once a lapsed run can no longer be continued. */
  days: number;
  /** The learner's own best run, which a lapse never takes away. */
  longest: number;
  /** Rounds finished today, after the day boundary has been applied. */
  solvedToday: number;
  /** Whether today's practice has already counted towards the streak. */
  countedToday: boolean;
  /** Running, not yet counted today: the state a reminder would act on. */
  atRisk: boolean;
  /**
   * Whether `days` counts days or weeks.
   *
   * Carried on the view so no screen has to fetch the setting separately to
   * know what word to put after the number — "3" meaning three weeks printed as
   * "3 day streak" is the one failure this whole field exists to prevent.
   */
  cadence: GoalCadence;
}

export const observeStreak = (
  progress: UserProgress,
  config: StreakConfig,
  now: Date = new Date(),
  cadence: GoalCadence = "daily",
): StreakView => {
  // The daily count is always daily: how much a child did today is a different
  // question from how the run is counted, and a weekly cadence must not make
  // "5 of 5 rounds" mean a week's worth.
  const today = dayKey(now, config.dayStartHour);
  const period = periodKey(now, config, cadence);
  const solvedToday = progress.lastPracticeDay === today ? progress.dailySolved : 0;
  const countedToday = config.enabled && progress.lastStreakDay === period;
  const running =
    config.enabled &&
    progress.lastStreakDay !== null &&
    stillRunning(progress.lastStreakDay, period, config, cadence);

  return {
    days: running ? progress.streakDays : 0,
    longest: progress.longestStreak,
    solvedToday,
    countedToday,
    atRisk: running && !countedToday,
    cadence,
  };
};

/**
 * One finished round, applied to the learner's record.
 *
 * Everything day-shaped happens here rather than at the three call sites that
 * used to write `dailySolved: prev.dailySolved + 1` — which is why that counter
 * climbed forever and the daily goal was met permanently after the first week.
 * Rolling the day over and crediting the streak are the same decision, taken
 * once, from the same day key.
 *
 * Returns the record unchanged in shape, so a caller may spread its own XP and
 * problem count on top.
 */
export const applyPractice = (
  progress: UserProgress,
  config: StreakConfig,
  now: Date = new Date(),
  cadence: GoalCadence = "daily",
): UserProgress => {
  const today = dayKey(now, config.dayStartHour);
  const period = periodKey(now, config, cadence);
  // A practice on a new day starts today's count at zero, whatever yesterday
  // reached. This is the only place the daily counter resets.
  const solvedToday = (progress.lastPracticeDay === today ? progress.dailySolved : 0) + 1;

  const next: UserProgress = {
    ...progress,
    dailySolved: solvedToday,
    lastPracticeDay: today,
  };

  if (!config.enabled) return next;
  // A period is credited once. Round two through five of an afternoon still
  // count towards the daily goal, but they cannot buy a second day of streak —
  // and on a weekly cadence, neither can Tuesday after Monday already counted.
  if (progress.lastStreakDay === period) return next;
  if (solvedToday < config.roundsPerDay) return next;

  const continues =
    progress.lastStreakDay !== null &&
    stillRunning(progress.lastStreakDay, period, config, cadence);
  const streakDays = continues ? progress.streakDays + 1 : 1;

  return {
    ...next,
    streakDays,
    longestStreak: Math.max(progress.longestStreak, streakDays),
    lastStreakDay: period,
  };
};

/** `applyPractice` against the rule the family has saved and the real clock. */
export const recordPractice = (progress: UserProgress, now: Date = new Date()): UserProgress =>
  applyPractice(progress, StreakAPI.current(), now, ChildSettingsAPI.current().goalCadence);

/**
 * The streak as a component should print it.
 *
 * Subscribes to the rule as well as reading the record, so a parent turning
 * streaks off on the Scoring page is reflected on Home without a reload.
 */
export const useStreak = (progress: UserProgress): StreakView & { config: StreakConfig } => {
  useSyncExternalStore(StreakAPI.subscribe, StreakAPI.version);
  // Both stores, because the rule is the family's and the cadence is this
  // child's: a parent switching a child to weekly must repaint the flame.
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version);
  const config = StreakAPI.current();
  const cadence = ChildSettingsAPI.current().goalCadence;
  return { ...observeStreak(progress, config, new Date(), cadence), config };
};
