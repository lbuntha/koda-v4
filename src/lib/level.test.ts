import { describe, expect, it } from "vitest";

import { XP_PER_LEVEL, levelFromXp, levelProgress, xpIntoLevel, xpToNextLevel } from "./level";

/**
 * A level is a reading of XP, so the only thing to pin down is the arithmetic
 * at the boundaries — and that it never stops, which is the whole point.
 */

describe("a learner's level", () => {
  it("starts at one, before any XP", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(1)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL - 1)).toBe(1);
  });

  it("turns over on the hundred", () => {
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(199)).toBe(2);
    expect(levelFromXp(200)).toBe(3);
  });

  it("keeps going, with no last level to reach", () => {
    expect(levelFromXp(10_000)).toBe(101);
    expect(levelFromXp(1_000_000)).toBe(10_001);
  });

  it("never reads as level zero, whatever it is handed", () => {
    // A corrupted or half-synced record must still produce a learner who is
    // somewhere, rather than one who is nowhere.
    expect(levelFromXp(-500)).toBe(1);
    expect(levelFromXp(Number.NaN)).toBe(1);
  });

  it("says how far through the level the learner is", () => {
    expect(xpIntoLevel(216)).toBe(16);
    expect(xpToNextLevel(216)).toBe(84);
    expect(levelProgress(216)).toBeCloseTo(0.16);
  });

  it("counts a level boundary as the start of the next, not the end of the last", () => {
    expect(xpIntoLevel(200)).toBe(0);
    expect(xpToNextLevel(200)).toBe(100);
    expect(levelProgress(200)).toBe(0);
  });
});
