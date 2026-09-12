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
    // the same kind of thing.
    expect(screen.getByText("XP Level 4")).toBeTruthy();
    expect(screen.getByText("60 XP to Level 5")).toBeTruthy();
    // "100 XP earns a level" used to sit under the bar as a third line. It was
    // dropped for height when this card was compacted — Home's rail states the
    // same rule under the same bar, and these two labels carry the scale.
    expect(screen.queryByText("100 XP earns a level")).toBeNull();
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

/**
 * The way out, mid-course.
 *
 * The exit used to be drawn only at the end of a path, where practice was on
 * offer. Everywhere else the screen read "Next lesson" and "Practice Again" —
 * both of which keep the child in the round — over a modal that covers the
 * sidebar. A child who had finished for the day had to play another round or
 * close the tab.
 */
describe("leaving at the end of a round", () => {
  it("offers both doors in the ordinary mid-course case", () => {
    const exit = vi.fn();
    const home = vi.fn();
    draw({ nextLevelNumber: 8, onBackToLessons: exit, onGoHome: home });

    // The two that carry on are still the loud ones.
    expect(screen.getByText("NEXT LESSON (8)")).toBeTruthy();
    expect(screen.getByText("Practice Again")).toBeTruthy();

    screen.getByText("Back to lessons").click();
    expect(exit).toHaveBeenCalled();

    screen.getByText("Home").click();
    expect(home).toHaveBeenCalled();
  });

  it("does not offer the lesson list twice when that is already the main button", () => {
    draw({ nextLevelNumber: undefined, onBackToLessons: vi.fn(), onGoHome: vi.fn() });

    expect(screen.getByText("BACK TO LESSONS")).toBeTruthy();
    expect(screen.queryByText("Back to lessons")).toBeNull();
    // Home is never what the main button does, so it stays.
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("draws no home door for a host that has no home", () => {
    // The teacher preview and the activity harness both have a list and no
    // dashboard; the SDK publishes `goHome` as null and this follows it.
    draw({ nextLevelNumber: 8, onBackToLessons: vi.fn() });

    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("Back to lessons")).toBeTruthy();
  });
});

/**
 * The card is the commonest screen in the app, so its height is a feature.
 */
describe("what the card does not repeat", () => {
  it("stays quiet when the advice is the button underneath it", () => {
    draw({ recommendation: { kind: "advance", kidMessage: "Nice work! Ready for the next one?" } });

    expect(screen.getByText("NEXT LESSON (8)")).toBeTruthy();
    expect(screen.queryByText("Nice work! Ready for the next one?")).toBeNull();
  });

  it("speaks up when the advice disagrees with the obvious move", () => {
    // A concept that has not landed turns the primary into another round, and
    // this line is the reason why — which the buttons cannot say on their own.
    draw({ recommendation: { kind: "practise", kidMessage: "One more round to make it stick!" } });

    expect(screen.getAllByText("One more round to make it stick!").length).toBeGreaterThan(0);
    expect(screen.getByText("ONE MORE ROUND")).toBeTruthy();
  });
});
