import { describe, expect, it } from "vitest";
import { starsFor, xpFor } from "./WordGuessPage";
import { scoreRound } from "../skills/kit";
import type { ScoringConfig } from "../lib/scoring";

const live: ScoringConfig = { xpPerLevel: 40, twoStarShare: 0.7, oneStarShare: 0.4, threeStarAt: 0.9, twoStarAt: 0.6 };

describe("Word Guess XP", () => {
  it("earns stars by guesses, and loses one per hint", () => {
    expect([1, 2, 3, 4, 5, 6].map((g) => starsFor(true, g))).toEqual([3, 3, 3, 2, 2, 1]);
    expect(starsFor(false, 6)).toBe(1);
    expect(starsFor(true, 2, 1)).toBe(2);
    expect(starsFor(true, 2, 2)).toBe(1);
    expect(starsFor(true, 6, 2)).toBe(1);
  });

  it("pays what a lesson round pays for the same stars", () => {
    expect(xpFor(true, 3, 0, live)).toBe(40);
    expect(xpFor(true, 5, 0, live)).toBe(28);
    expect(xpFor(false, 6, 0, live)).toBe(16);
    // A daily and a practice game are paid alike; only the daily cap tells them apart.
    for (const stars of [3, 2, 1] as const) {
      const guesses = stars === 3 ? 2 : stars === 2 ? 4 : 6;
      const lessonXp = scoreRound({ correctFirstTry: stars === 3 ? 10 : stars === 2 ? 7 : 0, total: 10 }).xp;
      expect(xpFor(true, guesses)).toBe(lessonXp);
    }
  });
});
