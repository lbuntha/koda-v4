import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The streak rule: one day of practice, one day of streak.
 *
 * What is under test is the arithmetic nobody wants to verify by waiting — a
 * day that counts once however many rounds are played, a run that survives
 * exactly as many missed days as the family allows, a daily count that rolls
 * over instead of climbing forever, and a boundary that is not midnight when a
 * parent says it is not.
 */

const STORAGE_KEY = "koda_streak_v1";

const saveRule = vi.fn();
vi.mock("./deploymentRules", () => ({
  saveDeploymentRule: (...args: unknown[]) => saveRule(...args),
}));

beforeEach(() => {
  vi.resetModules();
  saveRule.mockClear();
  localStorage.clear();
});

const mod = async () => await import("./streak");

/** A learner who has done nothing, with only the fields the rule touches. */
const learner = (patch: Partial<import("../types").UserProgress> = {}) =>
  ({
    xp: 0,
    level: 1,
    streakDays: 0,
    longestStreak: 0,
    lastStreakDay: null,
    lastPracticeDay: null,
    problemsSolved: 0,
    dailyGoal: 5,
    dailySolved: 0,
    unlockedSkills: [],
    masteryByTopic: {},
    recentBadges: [],
    ...patch,
  }) as import("../types").UserProgress;

/** Local noon on the given day, so no test sits on a boundary by accident. */
const on = (day: string, hour = 12) => {
  const d = new Date(`${day}T00:00:00`);
  d.setHours(hour, 0, 0, 0);
  return d;
};

describe("a day of practice", () => {
  it("earns the first day of the streak", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const next = applyPractice(learner(), STREAK_DEFAULTS, on("2026-08-22"));
    expect(next.streakDays).toBe(1);
    expect(next.lastStreakDay).toBe("2026-08-22");
    expect(next.dailySolved).toBe(1);
  });

  it("counts once however many rounds are played", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    let p = applyPractice(learner(), STREAK_DEFAULTS, on("2026-08-22"));
    p = applyPractice(p, STREAK_DEFAULTS, on("2026-08-22", 15));
    p = applyPractice(p, STREAK_DEFAULTS, on("2026-08-22", 18));
    expect(p.streakDays).toBe(1);
    // The daily goal still sees all three.
    expect(p.dailySolved).toBe(3);
  });

  it("adds a day when yesterday counted", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const p = applyPractice(
      learner({ streakDays: 4, longestStreak: 4, lastStreakDay: "2026-08-21" }),
      STREAK_DEFAULTS,
      on("2026-08-22"),
    );
    expect(p.streakDays).toBe(5);
    expect(p.longestStreak).toBe(5);
  });

  it("starts again at one after a missed day", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const p = applyPractice(
      learner({ streakDays: 9, longestStreak: 9, lastStreakDay: "2026-08-19" }),
      STREAK_DEFAULTS,
      on("2026-08-22"),
    );
    expect(p.streakDays).toBe(1);
    // The best run is a record, not a state: a lapse must not erase it.
    expect(p.longestStreak).toBe(9);
  });

  it("rolls the daily count over on a new day", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const p = applyPractice(
      learner({ dailySolved: 7, lastPracticeDay: "2026-08-21" }),
      STREAK_DEFAULTS,
      on("2026-08-22"),
    );
    expect(p.dailySolved).toBe(1);
  });
});

describe("the rule an owner sets", () => {
  it("holds the day back until the required rounds are done", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const config = { ...STREAK_DEFAULTS, roundsPerDay: 3 };
    let p = applyPractice(learner(), config, on("2026-08-22"));
    expect(p.streakDays).toBe(0);
    p = applyPractice(p, config, on("2026-08-22", 13));
    expect(p.streakDays).toBe(0);
    p = applyPractice(p, config, on("2026-08-22", 14));
    expect(p.streakDays).toBe(1);
  });

  it("forgives as many missed days as it is told to", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const config = { ...STREAK_DEFAULTS, graceDays: 1 };
    const before = learner({ streakDays: 6, longestStreak: 6, lastStreakDay: "2026-08-20" });
    // One missed day: the run continues.
    expect(applyPractice(before, config, on("2026-08-22")).streakDays).toBe(7);
    // Two: it does not.
    expect(applyPractice(before, config, on("2026-08-23")).streakDays).toBe(1);
  });

  it("counts a late-night session for the day it belongs to", async () => {
    const { applyPractice } = await mod();
    const config = { enabled: true, roundsPerDay: 1, graceDays: 0, dayStartHour: 4 };
    // 12:20am on the 23rd is still the 22nd's practice, so the 21st's run
    // continues rather than breaking on a day that was never missed.
    const p = applyPractice(
      learner({ streakDays: 3, longestStreak: 3, lastStreakDay: "2026-08-21" }),
      config,
      on("2026-08-23", 0),
    );
    expect(p.lastStreakDay).toBe("2026-08-22");
    expect(p.streakDays).toBe(4);
  });

  it("counts nothing while streaks are switched off", async () => {
    const { applyPractice, STREAK_DEFAULTS } = await mod();
    const config = { ...STREAK_DEFAULTS, enabled: false };
    const p = applyPractice(learner({ streakDays: 5, lastStreakDay: "2026-08-21" }), config, on("2026-08-22"));
    expect(p.streakDays).toBe(5);
    expect(p.lastStreakDay).toBe("2026-08-21");
    // The daily goal is not a streak feature, so it keeps counting.
    expect(p.dailySolved).toBe(1);
  });
});

describe("what the screen reads", () => {
  it("shows a lapsed run as zero without writing anything", async () => {
    const { observeStreak, STREAK_DEFAULTS } = await mod();
    const stored = learner({ streakDays: 11, longestStreak: 11, lastStreakDay: "2026-08-01" });
    const view = observeStreak(stored, STREAK_DEFAULTS, on("2026-08-22"));
    expect(view.days).toBe(0);
    expect(view.longest).toBe(11);
    expect(stored.streakDays).toBe(11);
  });

  it("keeps a run running on the day after it last counted", async () => {
    const { observeStreak, STREAK_DEFAULTS } = await mod();
    const view = observeStreak(
      learner({ streakDays: 3, lastStreakDay: "2026-08-21" }),
      STREAK_DEFAULTS,
      on("2026-08-22"),
    );
    expect(view.days).toBe(3);
    // Nothing done today yet — the state a nudge would act on.
    expect(view.atRisk).toBe(true);
    expect(view.countedToday).toBe(false);
  });

  it("reports yesterday's rounds as none done today", async () => {
    const { observeStreak, STREAK_DEFAULTS } = await mod();
    const view = observeStreak(
      learner({ dailySolved: 5, lastPracticeDay: "2026-08-21" }),
      STREAK_DEFAULTS,
      on("2026-08-22"),
    );
    expect(view.solvedToday).toBe(0);
  });

  it("reads as zero while streaks are off, whatever is stored", async () => {
    const { observeStreak, STREAK_DEFAULTS } = await mod();
    const view = observeStreak(
      learner({ streakDays: 4, lastStreakDay: "2026-08-22" }),
      { ...STREAK_DEFAULTS, enabled: false },
      on("2026-08-22"),
    );
    expect(view.days).toBe(0);
  });
});

describe("the shared rule", () => {
  it("starts at one round a day, no forgiveness, from midnight", async () => {
    const { StreakAPI } = await mod();
    expect(StreakAPI.current()).toEqual({
      enabled: true,
      roundsPerDay: 1,
      graceDays: 0,
      dayStartHour: 0,
    });
  });

  it("saves one rule for the whole deployment when it changes", async () => {
    const { StreakAPI } = await mod();
    StreakAPI.update({ graceDays: 2 });

    expect(saveRule).toHaveBeenCalledTimes(1);
    expect(saveRule.mock.calls[0][0]).toBe("streak");
    expect((saveRule.mock.calls[0][1] as { graceDays: number }).graceDays).toBe(2);
    // Written locally as well, so a device with no connection still scores by
    // the rule it last saw rather than the one it shipped with.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).graceDays).toBe(2);
  });

  it("refuses a stored rule that would make the streak meaningless", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roundsPerDay: 0, graceDays: 99, dayStartHour: 47 }));
    const { StreakAPI } = await mod();
    expect(StreakAPI.current()).toEqual({
      enabled: true,
      roundsPerDay: 1,
      graceDays: 6,
      dayStartHour: 23,
    });
  });

  it("takes the rule the deployment sends down", async () => {
    const { StreakAPI } = await mod();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...StreakAPI.current(), roundsPerDay: 4 }));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(StreakAPI.current().roundsPerDay).toBe(4);
  });
});

describe("a run counted by the week", () => {
  /**
   * The cadence that exists because a four-to-eight-year-old does not control
   * device access. What is under test is that a busy Tuesday costs nothing —
   * and that switching cadence does not quietly change the daily goal, which is
   * a different question with a different answer.
   */
  const rule = { enabled: true, roundsPerDay: 1, graceDays: 0, dayStartHour: 0 };

  it("counts one week however many days are practised in it", async () => {
    const { applyPractice } = await mod();
    // Monday, then Wednesday, then Friday of the same week.
    let p = applyPractice(learner(), rule, on("2026-08-24", 10), "weekly");
    expect(p.streakDays).toBe(1);
    p = applyPractice(p, rule, on("2026-08-26", 10), "weekly");
    expect(p.streakDays).toBe(1);
    p = applyPractice(p, rule, on("2026-08-28", 10), "weekly");
    expect(p.streakDays).toBe(1);
  });

  it("adds a week when the next one is practised in", async () => {
    const { applyPractice } = await mod();
    let p = applyPractice(learner(), rule, on("2026-08-24", 10), "weekly");
    p = applyPractice(p, rule, on("2026-09-01", 10), "weekly");

    expect(p.streakDays).toBe(2);
  });

  it("survives the gap that would break a daily run", async () => {
    const { applyPractice, observeStreak } = await mod();
    // Monday, then nothing until Sunday. Six missed days: a daily run is gone.
    const monday = applyPractice(learner(), rule, on("2026-08-24", 10), "weekly");
    const sunday = on("2026-08-30", 10);

    expect(observeStreak(monday, rule, sunday, "weekly").days).toBe(1);
    expect(observeStreak(monday, rule, sunday).days).toBe(0);
  });

  it("does end when a whole week is missed", async () => {
    const { applyPractice, observeStreak } = await mod();
    const p = applyPractice(learner(), rule, on("2026-08-24", 10), "weekly");

    // Two Mondays later: the week between has nothing in it.
    expect(observeStreak(p, rule, on("2026-09-07", 10), "weekly").days).toBe(0);
  });

  it("leaves the daily count daily", async () => {
    const { applyPractice, observeStreak } = await mod();
    const monday = applyPractice(learner(), rule, on("2026-08-24", 10), "weekly");

    // Same week, next day: the run holds, but today's rounds start at zero —
    // "5 of 5" must never come to mean a week's worth of work.
    const tuesday = on("2026-08-25", 10);
    const view = observeStreak(monday, rule, tuesday, "weekly");
    expect(view.days).toBe(1);
    expect(view.solvedToday).toBe(0);
  });

  it("says which unit its number is in", async () => {
    const { observeStreak } = await mod();

    expect(observeStreak(learner(), rule, new Date(), "weekly").cadence).toBe("weekly");
    expect(observeStreak(learner(), rule, new Date()).cadence).toBe("daily");
  });
});
