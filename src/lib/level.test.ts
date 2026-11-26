import { describe, expect, it } from "vitest";

import { currentLevelSize, levelFromXp, levelProgress, levelStartXp, xpIntoLevel, xpToNextLevel } from "./level";

/**
 * A level is a reading of XP, so the only thing to pin down is the arithmetic
 * at the boundaries — and that it never stops, which is the whole point.
 * Each level needs 100 XP more than the one before.
 */

describe("a learner's level", () => {
  it("starts at one, before any XP", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
  });

  it("needs a little more XP for each level than the last", () => {
    expect([1, 2, 3, 4, 5, 10].map(levelStartXp)).toEqual([0, 100, 300, 600, 1000, 4500]);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
    expect(levelFromXp(599)).toBe(3);
    expect(levelFromXp(600)).toBe(4);
  });

  it("turns over exactly where each level begins, far up the ladder too", () => {
    for (let level = 1; level <= 400; level++) {
      expect(levelFromXp(levelStartXp(level))).toBe(level);
      expect(levelFromXp(levelStartXp(level + 1) - 1)).toBe(level);
    }
  });

  it("reads a busy learner's XP as a level that still means something", () => {
    // 4,227 XP was Level 43 under a flat 100 a level.
    expect(levelFromXp(4227)).toBe(9);
  });

  it("keeps going, with no last level to reach", () => {
    expect(levelFromXp(1_000_000)).toBeGreaterThan(140);
  });

  it("never reads as level zero, whatever it is handed", () => {
    expect(levelFromXp(-500)).toBe(1);
    expect(levelFromXp(Number.NaN)).toBe(1);
  });

  it("says how far through the level the learner is", () => {
    // Level 2 runs 100–299: 200 XP wide.
    expect(xpIntoLevel(216)).toBe(116);
    expect(xpToNextLevel(216)).toBe(84);
    expect(currentLevelSize(216)).toBe(200);
    expect(levelProgress(216)).toBeCloseTo(0.58);
  });

  it("counts a level boundary as the start of the next, not the end of the last", () => {
    expect(xpIntoLevel(300)).toBe(0);
    expect(xpToNextLevel(300)).toBe(300);
    expect(levelProgress(300)).toBe(0);
  });
});
