import { ApiError, SessionAPI, accessToken, request } from "./sync";

/**
 * The figures a profile prints, read from the server's record.
 *
 * Deliberately not derived here. The page used to count stars out of the
 * device's completed-levels map and children out of a `/learners` response,
 * which meant the numbers only existed for as long as the render did — no
 * history, no way to correct one, and two screens free to disagree. These come
 * from one stored row per account, and this module only fetches it.
 *
 * `source` says whether anything has measured them yet. Until the feature that
 * writes them exists, every row is the seeded sample and says `"placeholder"`,
 * which is what the page badges — a sample number that looks measured is worse
 * than no number.
 */

export interface ProfileStats {
  source: "placeholder" | "recorded";
  updatedAt: string | null;

  /* Learner figures. */
  dayStreak: number;
  /** The best run ever. What a streak badge is measured against. */
  longestStreak: number;
  totalXp: number;
  level: number;
  starsEarned: number;
  lessonsMastered: number;
  lessonsAvailable: number;
  dailyGoal: number;
  dailySolved: number;
  topThreeFinishes: number;
  league: string | null;
  badges: string[];

  /* Family figures, for the parent reading. */
  childrenCount: number;
  codesWaiting: number;

  /* Platform figures, for the staff reading. */
  permissionsCount: number;
}

/**
 * What a device with no answer yet shows.
 *
 * Zeroes rather than invented numbers: a profile that cannot reach the server
 * should look like a profile nothing has been recorded against, not like a
 * learner who has done nothing wrong being told they have a 12-day streak.
 */
export const EMPTY_STATS: ProfileStats = {
  source: "placeholder",
  updatedAt: null,
  dayStreak: 0,
  longestStreak: 0,
  totalXp: 0,
  level: 1,
  starsEarned: 0,
  lessonsMastered: 0,
  lessonsAvailable: 0,
  dailyGoal: 5,
  dailySolved: 0,
  topThreeFinishes: 0,
  league: null,
  badges: [],
  childrenCount: 0,
  codesWaiting: 0,
  permissionsCount: 0,
};

const CACHE_KEY = "koda_profile_stats_v1";

const listeners = new Set<(row: ProfileStats) => void>();

/**
 * Told when a write lands, with the row the server returned.
 *
 * A profile that is already open would otherwise keep printing what it fetched
 * on mount — which, on the very first run, is the seeded sample the write is
 * replacing. One subscription is cheaper than polling and honest about when the
 * figures actually changed.
 */
export function subscribeProfileStats(cb: (row: ProfileStats) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Whose row this is — the same subject the server picks from the token.
 *
 * Cached per subject rather than per device, because one tablet is used by a
 * parent and each of their children in turn, and a child must never open their
 * profile to the figures of whoever was signed in before them.
 */
function subject(): string | null {
  const session = SessionAPI.current();
  if (!session) return null;
  return session.learnerId ?? session.userId ?? session.deviceId;
}

function readCache(key: string): ProfileStats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, ProfileStats>) : {};
    return all[key] ?? null;
  } catch {
    return null;
  }
}

function writeCache(key: string, row: ProfileStats): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, ProfileStats>) : {};
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...all, [key]: row }));
  } catch {
    // A blocked store costs this device its offline copy and nothing else.
  }
}

/**
 * The signed-in account's own row, from the server when it can be reached and
 * from the last answer when it cannot.
 *
 * The cache is the whole reason this is not a plain fetch. These figures used
 * to be computed from `localStorage`, which meant they were always there; move
 * them to the server without a cache and a tablet in a drawer for a week opens
 * its profile to a wall of zeroes, which reads as lost progress rather than as
 * a missing connection. Last known beats invented.
 *
 * Never throws — offline is not an error a profile page should render instead
 * of a profile.
 */
export async function fetchProfileStats(): Promise<ProfileStats | null> {
  const key = subject();
  try {
    const token = await accessToken();
    if (!token) return key ? readCache(key) : null;
    const row = await request<ProfileStats>("/profile/stats", { token });
    if (key) writeCache(key, row);
    return row;
  } catch (error) {
    void (error as ApiError);
    return key ? readCache(key) : null;
  }
}

/**
 * Write some of the figures.
 *
 * The seam for whatever measures them — see `publishLearnerFigures`, which is
 * what fills it. This is what turns a row from `placeholder` into `recorded`.
 */
export async function recordProfileStats(
  patch: Partial<Omit<ProfileStats, "source" | "updatedAt">>,
): Promise<ProfileStats | null> {
  const token = await accessToken();
  if (!token) return null;
  const row = await request<ProfileStats>("/profile/stats", {
    method: "PATCH",
    token,
    body: patch,
  });
  // The write already knows the new figures, so the offline copy learns them
  // without waiting for the next read.
  const key = subject();
  if (key) writeCache(key, row);
  for (const cb of listeners) cb(row);
  return row;
}

/** Everything on the profile a learner's own device can actually measure. */
export interface LearnerFigures {
  dayStreak: number;
  longestStreak: number;
  totalXp: number;
  level: number;
  starsEarned: number;
  lessonsMastered: number;
  lessonsAvailable: number;
  dailyGoal: number;
  dailySolved: number;
  /** Ids of the badges earned, resolved to names by whoever prints them. */
  badges: string[];
}

/**
 * Put this device's real figures on the learner's stored row.
 *
 * The profile does not read the tablet it is opened on; it reads one row per
 * subject, which is what gives a statistic an owner and a history. That row was
 * seeded and never written, so a child with 188 XP on Home opened their own
 * profile to a sample zero and a badge admitting it. This is the writer that
 * was missing.
 *
 * Every figure sent here has something real behind it — the streak as the rule
 * currently reads it, XP and level from the learner's record, stars and mastered
 * lessons from the levels they have finished, badges from the family's rules
 * measured against all of it. The two the row still carries with no feature
 * behind them, `league` and `topThreeFinishes`, are deliberately left alone
 * rather than filled with a plausible number.
 *
 * Never throws. A device that cannot reach the server has still recorded the
 * round locally, and will write the figures through on the next one.
 */
export async function publishLearnerFigures(figures: LearnerFigures): Promise<void> {
  try {
    await recordProfileStats(figures);
  } catch (error) {
    void (error as ApiError);
  }
}
