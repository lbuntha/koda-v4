import type { TopicCategory, UserProgress } from "../types";
import { DAILY_GOAL_DEFAULT, DailyGoalAPI } from "./dailyGoal";
import { levelFromXp } from "./level";
import { learnerId as deviceLearnerId } from "./learning/learningLog";
import { SessionAPI, SyncEngine, storageKeyFor } from "./sync";

/**
 * The learner's own progress, kept on this device.
 *
 * Everything else already survived a reload — skill settings, the scoring
 * rates, store listings — while the child's XP and stars did not, because they
 * were plain React state seeded with demo values. So a round played yesterday
 * left no trace, which is the one thing that makes testing a change confusing.
 *
 * One record per *learner*, not per device. That distinction is the whole point
 * of `recordKey`: a family tablet is used by each child in turn, and while both
 * read one key the second child to sign in opened the app to the first one's XP
 * and streak — then saved it back up under their own name, so the mix-up
 * reached the server and every other device. Whose record this is comes from
 * the session, because that is the only thing that knows which child is here.
 */

/** Where the record lived before it belonged to a particular learner. */
const LEGACY_PROGRESS_KEY = "koda_learner_progress_v1";
const LEGACY_LEVELS_KEY = "koda_completed_levels_v1";

/**
 * Whose record this device is reading and writing.
 *
 * The signed-in child, when there is one. An adult playing on their own account
 * has no learner id, and falls back to the device's — which is what every
 * record used before this, so nothing that has been recorded is stranded.
 */
export const currentLearnerId = (): string =>
  SessionAPI.current()?.learnerId ?? deviceLearnerId;

const progressKey = (): string => storageKeyFor("progress", currentLearnerId())!;
const levelsKey = (): string => storageKeyFor("levels", currentLearnerId())!;

/** A learner who has done nothing yet. */
export const EMPTY_PROGRESS: UserProgress = {
  xp: 0,
  level: 1,
  streakDays: 0,
  longestStreak: 0,
  lastStreakDay: null,
  lastPracticeDay: null,
  problemsSolved: 0,
  dailyGoal: DAILY_GOAL_DEFAULT,
  dailySolved: 0,
  unlockedSkills: [],
  // Every topic at zero: the type is a closed set, so a fresh learner is
  // "no mastery anywhere", not "no topics".
  masteryByTopic: Object.fromEntries(
    (
      [
        "balance_equations",
        "fraction_lab",
        "spatial_puzzles",
        "exponent_growth",
        "coordinate_quest",
        "logic_matrix",
        "number_bonds",
        "base_ten_blocks",
        "time_and_money",
      ] as TopicCategory[]
    ).map((t) => [t, 0]),
  ) as Record<TopicCategory, number>,
  recentBadges: [],
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A blocked or full store must not take the app down. The session still
    // works; it just will not be there next time.
  }
};

/**
 * The record a device kept before records were per-learner, claimed once.
 *
 * Only a learner reading claims it, and only if that learner has no record of
 * their own yet — the device's existing XP and stars belong to the child who
 * earned them, and handing a copy to every child who signs in afterwards would
 * turn one real record into several false ones. The legacy key is removed as it
 * is claimed, so the claim happens exactly once.
 */
const claimLegacy = (legacyKey: string, ownKey: string): void => {
  try {
    if (!SessionAPI.current()?.learnerId) return;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy === null || localStorage.getItem(ownKey) !== null) return;
    localStorage.setItem(ownKey, legacy);
    localStorage.removeItem(legacyKey);
  } catch {
    /* see write() */
  }
};

/**
 * The learner's record, with the daily goal their family has set for them.
 *
 * The goal is overlaid rather than stored here. It belongs to whoever may set
 * it — a parent, or a student over themselves — and their device writes it as
 * its own document; the copy in this record is a mirror, so that everything
 * downstream (Home, the round chrome, the profile) keeps reading one number
 * from one place.
 */
export const loadProgress = (): UserProgress => {
  const key = progressKey();
  claimLegacy(LEGACY_PROGRESS_KEY, key);
  const stored = read(key, EMPTY_PROGRESS);
  return {
    ...stored,
    dailyGoal: DailyGoalAPI.for(currentLearnerId()),
    // Read from XP rather than trusted: the stored copy is a mirror, and every
    // record written before levels were derived holds a stale 1.
    level: levelFromXp(stored.xp),
  };
};

export const saveProgress = (p: UserProgress): void => {
  const learner = currentLearnerId();
  // The mirror is kept correct on the way out too, so the server's copy and
  // anything reading the raw document agree with what the app shows.
  const record = { ...p, level: levelFromXp(p.xp) };
  write(storageKeyFor("progress", learner)!, record);
  // Keyed by learner, and merged rather than overwritten on the server: two
  // devices playing the same child must never subtract XP from each other.
  SyncEngine.recordDoc("progress", learner, record as unknown as Record<string, unknown>, {
    learnerId: learner,
  });
};

/** levelNumber -> best stars earned. */
export const loadCompletedLevels = (): Record<number, number> => {
  const key = levelsKey();
  claimLegacy(LEGACY_LEVELS_KEY, key);
  return read(key, {});
};

export const saveCompletedLevels = (levels: Record<number, number>): void => {
  const learner = currentLearnerId();
  write(storageKeyFor("levels", learner)!, levels);
  SyncEngine.recordDoc("levels", learner, levels as unknown as Record<string, unknown>, {
    learnerId: learner,
  });
};

/**
 * Told when this learner's record changes underneath the app.
 *
 * Two things do that: another tab, and a document pulled from another device —
 * which `apply.ts` announces as a `storage` event on the key it wrote. Without
 * this, a child signing in on a second device would see an empty profile until
 * they reloaded, because their record arrives a moment after the sign-in that
 * asked for it.
 */
export const subscribeLearnerRecord = (cb: () => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === progressKey() || event.key === levelsKey()) cb();
  };
  window.addEventListener("storage", onStorage);
  // The goal has its own store and its own listener, and covers both sources:
  // a goal set here (which raises no storage event, the browser only tells
  // other tabs) and one pulled from the device a parent set it on.
  const stopGoal = DailyGoalAPI.subscribe(cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    stopGoal();
  };
};

/**
 * Back to a learner who has done nothing.
 *
 * No screen calls this any more — erasing a child's stars is not a thing a
 * parent should be able to do by mis-tapping in Settings, and an operator has
 * the deployment-wide reset on the System tab for the case that actually comes
 * up. Kept because the tests pin the behaviour and the next caller will want it
 * correct rather than rewritten.
 */
export const clearProgress = (): void => {
  try {
    localStorage.removeItem(progressKey());
    localStorage.removeItem(levelsKey());
  } catch {
    /* see write() */
  }
};
