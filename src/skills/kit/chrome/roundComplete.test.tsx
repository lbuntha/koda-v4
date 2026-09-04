import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { PracticeRoundCompleteModal } from "./RoundCompleteModal";

/**
 * The screen a child gets when a round ends.
 *
 * The rule behind the headline is pinned in `roundPraise.test.ts`; this is
 * about what actually reaches the screen — that the three figures a round pays
 * into are all drawn, that the level bar reads the learner's real position, and
 * that a mount with no standing at all still produces a usable screen rather
 * than a row of zeroes claiming a broken streak.
 */

vi.mock("../../../utils/audio", () => ({ playSound: vi.fn() }));

const draw = (over: Partial<React.ComponentProps<typeof PracticeRoundCompleteModal>> = {}) =>
  render(
    <PracticeRoundCompleteModal
      levelNumber={7}
      levelTitle="Count the Row"
      stars={2}
      xpWon={40}
      nextLevelNumber={8}
      onNextLevel={() => {}}
      onPracticeAgain={() => {}}
      standing={{ xpAfter: 340, streakDays: 4, dailySolved: 2, dailyGoal: 5 }}
      {...over}
    />,
  );

describe("what the round was worth", () => {
  it("shows the XP won, the streak and today's count against the goal", () => {
    draw();

    expect(screen.getByText("+40")).toBeTruthy();
    expect(screen.getByText("XP won")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("days in a row")).toBeTruthy();
    expect(screen.getByText("2/5")).toBeTruthy();
  });

  it("says week, not day, for a family whose flame counts weeks", () => {
    draw({
      standing: { xpAfter: 340, streakDays: 2, cadence: "weekly", dailySolved: 1, dailyGoal: 5 },
    });

    expect(screen.getByText("weeks in a row")).toBeTruthy();
  });

  it("draws the level bar where the learner actually stands", () => {
    draw({ standing: { xpAfter: 340, streakDays: 4, dailySolved: 2, dailyGoal: 5 } });

    // 340 XP is Level 4, forty into it, sixty short of Level 5.
    expect(screen.getByText("Level 4")).toBeTruthy();
    expect(screen.getByText("60 XP to Level 5")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: /Level 4 progress/ });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("still draws a complete screen when the host answered with nothing", () => {
    draw({ standing: undefined });

    // No invented streak, no level bar claiming Level 1 of nothing — but the
    // round's own reward, the stars and the buttons are all still there.
    expect(screen.getByText("+40")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/Count the Row/)).toBeTruthy();
  });
});

describe("the headline names what happened", () => {
  it("calls out the level a round carried the learner into", () => {
    draw({ standing: { xpAfter: 400, streakDays: 4, dailySolved: 2, dailyGoal: 5 } });

    expect(screen.getByText("Level 5!")).toBeTruthy();
    expect(screen.getByText("New level")).toBeTruthy();
  });

  it("calls out a perfect round", () => {
    draw({ perfect: true, stars: 3 });

    expect(screen.getByText("Every single one!")).toBeTruthy();
  });

  it("calls the course position a lesson, not a level", () => {
    // "Level" on this card means the learner's XP level, which the bar below
    // shows. The path position is a lesson, the way the skill page counts them
    // ("5 of 15 lessons complete") — one word cannot mean both numbers.
    draw({ perfect: true, totalLessons: 15 });

    expect(screen.getByText("Lesson 7 of 15 · Count the Row")).toBeTruthy();
    expect(screen.getByText(/NEXT LESSON/)).toBeTruthy();
  });

  it("still names the lesson when the course length is unknown", () => {
    draw({ perfect: true });

    expect(screen.getByText("Lesson 7 · Count the Row")).toBeTruthy();
  });

  it("returns to the lesson list when the skill path is complete", () => {
    draw({ nextLevelNumber: undefined });

    expect(screen.getByText("BACK TO LESSONS")).toBeTruthy();
    expect(screen.queryByText(/NEXT LESSON/)).toBeNull();
  });
});
