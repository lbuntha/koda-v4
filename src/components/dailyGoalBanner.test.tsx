import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a child reads when the day's goal is done.
 *
 * The counting is `streak.ts`'s and is tested there; these assert the sentence,
 * and the two it must not say — a target moved the moment it was reached, and a
 * "1-day streak" that is not a streak.
 */

vi.mock("../lib/deploymentRules", () => ({ saveDeploymentRule: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(cleanup);

const today = (): string => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${`${d.getDate()}`.padStart(2, "0")}`;
};

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

const draw = async (progress: import("../types").UserProgress) => {
  const { DailyGoalBanner } = await import("./DailyGoalBanner");
  return render(<DailyGoalBanner userProgress={progress} />);
};

const met = (patch: Partial<import("../types").UserProgress> = {}) =>
  learner({ lastPracticeDay: today(), dailySolved: 5, dailyGoal: 5, ...patch });

describe("the card a child reads when the goal is done", () => {
  it("says the goal is met, and names the run behind it", async () => {
    await draw(met({ streakDays: 4, lastStreakDay: today() }));

    expect(screen.getByText("Goal met — 5 of 5 today")).toBeTruthy();
    expect(screen.getByText("That's 4 days in a row.")).toBeTruthy();
  });

  it("never calls one day a streak, and never asks for more", async () => {
    await draw(met({ streakDays: 1, lastStreakDay: today() }));

    expect(screen.getByText("Come back tomorrow to start a streak.")).toBeTruthy();
    expect(screen.queryByText(/1-day|1 day/)).toBeNull();
    expect(screen.queryByText(/keep going|one more|next goal/i)).toBeNull();
  });

  it("counts past the goal as met", async () => {
    await draw(met({ dailySolved: 7 }));

    expect(screen.getByText("Goal met — 7 of 5 today")).toBeTruthy();
  });

  it("draws nothing before the goal is reached", async () => {
    const { container } = await draw(met({ dailySolved: 4 }));

    expect(container.firstChild).toBeNull();
  });

  it("draws nothing for a day with no practice in it", async () => {
    const { container } = await draw(learner({ dailySolved: 5 }));

    expect(container.firstChild).toBeNull();
  });

  it("stays dismissed for the rest of that day", async () => {
    const progress = met();
    const view = await draw(progress);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss goal met message" }));
    // The card fades before it goes, and it is the going that is remembered.
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    view.unmount();
    const { container } = await draw(progress);

    expect(container.firstChild).toBeNull();
  });
});
