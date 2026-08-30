import { describe, expect, it } from "vitest";

import { levelledUp, roundPraise, STREAK_MILESTONES, type PraiseFacts } from "./roundPraise";
import { XP_PER_LEVEL } from "../../../lib/level";

/**
 * What a child is congratulated for.
 *
 * The rule is an ordering, and the ordering is the whole design: a screen that
 * celebrates five things at once celebrates none of them, so exactly one fact
 * wins the headline. These tests pin which one — including the cases where two
 * are true at the same time, which is where a "biggest news" rule earns its
 * keep.
 */

/** An ordinary finished round: nothing remarkable, nothing broken. */
const round = (over: Partial<PraiseFacts> = {}): PraiseFacts => ({
  stars: 2,
  perfect: false,
  xpWon: 40,
  xpAfter: 340,
  streakDays: 2,
  dailySolved: 2,
  dailyGoal: 5,
  ...over,
});

describe("the biggest news wins the headline", () => {
  it("a new level beats everything, including a perfect round", async () => {
    const praise = roundPraise(
      round({
        // 380 -> 420 crosses the 400 boundary.
        xpWon: 40,
        xpAfter: 420,
        perfect: true,
        stars: 3,
        streakDays: 7,
      }),
    );

    expect(praise.kind).toBe("levelUp");
    expect(praise.headline).toBe("Level 5!");
  });

  it("a streak milestone beats a perfect round", () => {
    const praise = roundPraise(round({ streakDays: 7, perfect: true, stars: 3 }));

    expect(praise.kind).toBe("streak");
    expect(praise.headline).toBe("7 days in a row!");
  });

  it("a perfect round beats meeting the daily goal", () => {
    const praise = roundPraise(round({ perfect: true, dailySolved: 5, dailyGoal: 5 }));

    expect(praise.kind).toBe("perfect");
    expect(praise.headline).toBe("Every single one!");
  });

  it("falls back to the stars when nothing else happened", () => {
    expect(roundPraise(round({ stars: 3 })).kind).toBe("stars");
    expect(roundPraise(round({ stars: 3 })).headline).toBe("Brilliantly done!");
    expect(roundPraise(round({ stars: 2 })).headline).toBe("Nicely done!");
    expect(roundPraise(round({ stars: 1 })).headline).toBe("You finished it!");
  });
});

describe("a new level", () => {
  it("is the level the round arrived at, not the one it left", () => {
    // 90 XP, +40 -> 130. Level 1 becomes Level 2.
    const praise = roundPraise(round({ xpWon: 40, xpAfter: 130 }));

    expect(praise.headline).toBe("Level 2!");
  });

  it("is not claimed by a round that only moved within a level", () => {
    expect(levelledUp(150, 40)).toBe(false);
    expect(roundPraise(round({ xpWon: 40, xpAfter: 150 })).kind).not.toBe("levelUp");
  });

  it("is not claimed by a round that paid nothing", () => {
    // A learner sitting exactly on a boundary has not just crossed it.
    expect(levelledUp(XP_PER_LEVEL, 0)).toBe(false);
  });

  it("is claimed exactly on the boundary the level begins at", () => {
    expect(levelledUp(XP_PER_LEVEL, 40)).toBe(true);
  });
});

describe("a streak", () => {
  it("is called out on a milestone and stays quiet between them", () => {
    for (const days of STREAK_MILESTONES) {
      expect(roundPraise(round({ streakDays: days })).kind, `${days} days`).toBe("streak");
    }
    // 4, 6, 8 sit between milestones. The flame is still shown on the screen —
    // it just does not take the headline, so a milestone still feels like one.
    for (const days of [1, 2, 4, 6, 8, 9]) {
      expect(roundPraise(round({ streakDays: days })).kind, `${days} days`).not.toBe("streak");
    }
  });

  it("counts weeks for a family whose flame counts weeks", () => {
    const praise = roundPraise(round({ streakDays: 3, cadence: "weekly" }));

    expect(praise.headline).toBe("3 weeks in a row!");
  });

  it("says day, singular, when there is only one", () => {
    // Not a milestone today, but the wording has to hold when one becomes one.
    const praise = roundPraise(round({ streakDays: 1, cadence: "weekly" }));
    expect(praise.kind).not.toBe("streak");
    expect(roundPraise(round({ streakDays: 3 })).headline).toContain("days");
  });
});

describe("the daily goal", () => {
  it("is marked on the round that meets it", () => {
    const praise = roundPraise(round({ dailySolved: 5, dailyGoal: 5 }));

    expect(praise.kind).toBe("goal");
    expect(praise.note).toContain("5 rounds");
  });

  it("is not repeated on every round after it", () => {
    // Otherwise the one moment worth marking becomes wallpaper for the rest of
    // the afternoon, and the child stops reading the line.
    expect(roundPraise(round({ dailySolved: 6, dailyGoal: 5 })).kind).toBe("stars");
    expect(roundPraise(round({ dailySolved: 9, dailyGoal: 5 })).kind).toBe("stars");
  });

  it("is not claimed when the learner has no goal set", () => {
    expect(roundPraise(round({ dailySolved: 0, dailyGoal: 0 })).kind).toBe("stars");
  });

  it("reads as one round when the goal is one", () => {
    expect(roundPraise(round({ dailySolved: 1, dailyGoal: 1 })).note).toContain("1 round done");
  });
});

describe("whatever happened", () => {
  it("always produces a headline, a tag and a note", () => {
    const cases: PraiseFacts[] = [
      round(),
      round({ stars: 1, xpWon: 0, xpAfter: 0, streakDays: 0, dailySolved: 0, dailyGoal: 0 }),
      round({ perfect: true }),
      round({ streakDays: 100 }),
      round({ xpAfter: 1000, xpWon: 40 }),
    ];

    for (const facts of cases) {
      const praise = roundPraise(facts);
      expect(praise.tag.length, JSON.stringify(facts)).toBeGreaterThan(0);
      expect(praise.headline.length).toBeGreaterThan(0);
      expect(praise.note.length).toBeGreaterThan(0);
    }
  });

  it("never puts a raw NaN or undefined into a sentence", () => {
    const praise = roundPraise(
      round({ xpAfter: Number.NaN, xpWon: Number.NaN, streakDays: Number.NaN }),
    );

    expect(`${praise.headline} ${praise.note}`).not.toMatch(/NaN|undefined/);
  });
});
