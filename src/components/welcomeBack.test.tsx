import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the band says, and what it must never say.
 *
 * The wording is the feature here — the arithmetic is tested in
 * `absence.test.ts` — so these assert the sentences a child actually reads, and
 * one of them asserts an absence: no screen may tell a seven-year-old what
 * their lapsed streak used to be.
 */

vi.mock("../lib/deploymentRules", () => ({
  saveDeploymentRule: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(cleanup);

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

/** `YYYY-MM-DD` for a whole number of days before now, on the local clock. */
const daysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const draw = async (progress: import("../types").UserProgress) => {
  const { WelcomeBack } = await import("./WelcomeBack");
  return render(<WelcomeBack userProgress={progress} />);
};

describe("the band a returning learner reads", () => {
  it("counts the days and points at what is underneath", async () => {
    await draw(learner({ lastPracticeDay: daysAgo(3), streakDays: 6, lastStreakDay: daysAgo(3) }));
    expect(screen.getByText("It's been 3 days. Pick anything below to start again.")).toBeTruthy();
  });

  it("never tells a child what their lapsed streak used to be", async () => {
    await draw(learner({ lastPracticeDay: daysAgo(9), streakDays: 12, lastStreakDay: daysAgo(9) }));
    expect(screen.queryByText(/12/)).toBeNull();
    expect(screen.queryByText(/lost|missed|broke/i)).toBeNull();
  });

  it("names a run that is still alive and owed a day", async () => {
    await draw(learner({ lastPracticeDay: daysAgo(1), streakDays: 4, lastStreakDay: daysAgo(1) }));
    expect(screen.getByText("Your 4-day streak is waiting.")).toBeTruthy();
  });

  it("does not say '1-day streak' to somebody one day in", async () => {
    await draw(learner({ lastPracticeDay: daysAgo(1), streakDays: 1, lastStreakDay: daysAgo(1) }));
    expect(screen.getByText("You practised yesterday — one round keeps it going.")).toBeTruthy();
  });

  it("draws nothing at all for a child who practised today", async () => {
    const { container } = await draw(
      learner({ lastPracticeDay: daysAgo(0), streakDays: 2, lastStreakDay: daysAgo(0) }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("draws nothing for a learner who has never started", async () => {
    const { container } = await draw(learner());
    expect(container.firstChild).toBeNull();
  });

  it("draws nothing once a family has switched streaks off", async () => {
    localStorage.setItem("koda_streak_v1", JSON.stringify({ enabled: false }));
    const { container } = await draw(
      learner({ lastPracticeDay: daysAgo(5), streakDays: 3, lastStreakDay: daysAgo(5) }),
    );
    expect(container.firstChild).toBeNull();
  });
});
