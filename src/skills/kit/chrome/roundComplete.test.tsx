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

    // 340 XP is Level 4, forty into it, sixty short of Level 5. Named "XP
    // Level" because "Lesson 7" is on the same card and the two numbers are not
    // the same kind of thing; the rule that turns one into the other is printed
    // under the bar, which is the only place either is ever explained.
    expect(screen.getByText("XP Level 4")).toBeTruthy();
    expect(screen.getByText("60 XP to Level 5")).toBeTruthy();
    expect(screen.getByText("100 XP earns a level")).toBeTruthy();
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

/**
 * The end of a path.
 *
 * The last lesson used to end exactly like the first — "Round complete", and a
 * button back to a list with nothing left on it. A child who has finished a
 * course is told they finished it, and is offered the practice that was sitting
 * unopened underneath.
 */
describe("the last lesson of a path", () => {
  it("says the skill is finished rather than counting a round", () => {
    draw({ pathComplete: true, nextLevelNumber: undefined, levelNumber: 15, totalLessons: 15 });

    expect(screen.getByText("Skill complete")).toBeTruthy();
    expect(screen.getByText("You finished every lesson!")).toBeTruthy();
    expect(screen.getByText("Lesson 15 of 15 · Count the Row")).toBeTruthy();
  });

  it("outranks a new level, which is the commoner thing", () => {
    draw({ pathComplete: true, standing: { xpAfter: 400, streakDays: 4, dailySolved: 2, dailyGoal: 5 } });

    expect(screen.getByText("You finished every lesson!")).toBeTruthy();
    expect(screen.queryByText("Level 5!")).toBeNull();
  });

  it("offers practice as practice, not as the next lesson", () => {
    const open = vi.fn();
    draw({ pathComplete: true, nextLevelNumber: 1, nextIsPractice: true, onNextLevel: open });

    expect(screen.getByText("TRY A PRACTICE ROUND")).toBeTruthy();
    expect(screen.queryByText(/NEXT LESSON/)).toBeNull();
  });

  it("keeps a way out when both buttons stay in the round", () => {
    const exit = vi.fn();
    draw({
      pathComplete: true,
      nextLevelNumber: 1,
      nextIsPractice: true,
      onBackToLessons: exit,
    });

    screen.getByText("Back to lessons").click();
    expect(exit).toHaveBeenCalled();
  });

  it("counts practice rounds as practice", () => {
    draw({ practiceRound: true, levelNumber: 3, totalLessons: 5 });

    expect(screen.getByText("Practice 3 of 5 · Count the Row")).toBeTruthy();
  });

  it("names the practice set, not the lessons, at the end of practice", () => {
    draw({ pathComplete: true, practiceRound: true, nextLevelNumber: undefined });

    expect(screen.getByText("Every practice round done!")).toBeTruthy();
    expect(screen.getByText("BACK TO LESSONS")).toBeTruthy();
  });
});
