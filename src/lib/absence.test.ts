import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Being away, as the band on Home reads it.
 *
 * The arithmetic nobody wants to verify by waiting: how long it has been, when
 * that is worth saying out loud, and — the half that matters more — every route
 * to saying nothing at all. A greeting that fires on a child who practised this
 * morning is worse than no greeting.
 */

const saveRule = vi.fn();
vi.mock("./deploymentRules", () => ({
  saveDeploymentRule: (...args: unknown[]) => saveRule(...args),
}));

beforeEach(() => {
  vi.resetModules();
  saveRule.mockClear();
  localStorage.clear();
});

const mod = async () => await import("./absence");
const rule = async () => (await import("./streak")).STREAK_DEFAULTS;

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

describe("when there is nothing to say", () => {
  it("says nothing to a child who has practised today", async () => {
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-12", dailySolved: 2 }),
      await rule(),
      on("2026-09-12"),
    );
    expect(view.state).toBe("quiet");
    expect(view.daysAway).toBe(0);
  });

  it("says nothing to a learner who has never started", async () => {
    // "Good to see you back" to somebody who has never been here would be the
    // band's first sentence and its first lie.
    const { observeAbsence } = await mod();
    const view = observeAbsence(learner(), await rule(), on("2026-09-12"));
    expect(view.state).toBe("quiet");
    expect(view.daysAway).toBe(0);
  });

  it("says nothing about a single day, when no run is owed one", async () => {
    // A child who practised yesterday and has opened the app before school has
    // missed nothing at all.
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-11" }),
      await rule(),
      on("2026-09-12"),
    );
    expect(view.state).toBe("quiet");
  });

  it("says nothing at all once a family has switched streaks off", async () => {
    const { observeAbsence } = await mod();
    const { STREAK_DEFAULTS } = await import("./streak");
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-01", streakDays: 4, lastStreakDay: "2026-09-01" }),
      { ...STREAK_DEFAULTS, enabled: false },
      on("2026-09-12"),
    );
    expect(view.state).toBe("quiet");
  });
});

describe("a run that is owed a day", () => {
  it("names the streak that is waiting", async () => {
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-11", streakDays: 4, lastStreakDay: "2026-09-11" }),
      await rule(),
      on("2026-09-12"),
    );
    expect(view.state).toBe("due");
    expect(view.streakDays).toBe(4);
    expect(view.daysAway).toBe(1);
  });

  it("leaves a weekly family alone on a Tuesday", async () => {
    // Their run is not owed anything today, so a deadline would be invented.
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-11", streakDays: 3, lastStreakDay: "2026-09-07" }),
      await rule(),
      on("2026-09-12"),
      "weekly",
    );
    expect(view.state).toBe("quiet");
    expect(view.cadence).toBe("weekly");
  });
});

describe("a real gap", () => {
  it("counts the days and greets them back", async () => {
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-09", streakDays: 6, lastStreakDay: "2026-09-09" }),
      await rule(),
      on("2026-09-12"),
    );
    expect(view.state).toBe("away");
    expect(view.daysAway).toBe(3);
  });

  it("reports the lapsed run as no run, and never as a loss", async () => {
    // The view has no field for what was lost, which is the point: a screen
    // cannot print "you lost your 9-day streak" without someone adding one.
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-08-30", streakDays: 9, lastStreakDay: "2026-08-30" }),
      await rule(),
      on("2026-09-12"),
    );
    expect(view.state).toBe("away");
    expect(view.streakDays).toBe(0);
    expect(view).not.toHaveProperty("streakLost");
  });

  it("greets a weekly family back too, once the gap is real", async () => {
    const { observeAbsence } = await mod();
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-05", streakDays: 2, lastStreakDay: "2026-08-31" }),
      await rule(),
      on("2026-09-12"),
      "weekly",
    );
    expect(view.state).toBe("away");
    expect(view.daysAway).toBe(7);
  });

  it("reads the day boundary the family set, not midnight", async () => {
    // 1am on the 12th is still the 11th for a household that starts its day at
    // four, so a child up late has been away two days, not three.
    const { observeAbsence } = await mod();
    const { STREAK_DEFAULTS } = await import("./streak");
    const view = observeAbsence(
      learner({ lastPracticeDay: "2026-09-09" }),
      { ...STREAK_DEFAULTS, dayStartHour: 4 },
      on("2026-09-12", 1),
    );
    expect(view.daysAway).toBe(2);
  });
});
