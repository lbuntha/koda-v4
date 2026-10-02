import { describe, expect, it } from "vitest";
import { SCORING_DEFAULTS } from "../../lib/scoring";
import { stepXp } from "./reward";

const scoring = { ...SCORING_DEFAULTS, xpPerLevel: 20, twoStarShare: 0.7, oneStarShare: 0.4 };

describe("stepXp", () => {
  it("pays a passed step by stars, like a lesson round", () => {
    expect(stepXp("up", 3, 30, scoring)).toBe(30);
    expect(stepXp("up", 2, 30, scoring)).toBe(21);
    expect(stepXp("canDo", 1, 30, scoring)).toBe(12);
  });

  it("uses the app's XP per level when the collection sets none", () => {
    expect(stepXp("up", 3, null, scoring)).toBe(20);
    expect(stepXp("learned", 3, undefined, scoring)).toBe(20);
  });

  it("pays nothing for a try that passed no step", () => {
    expect(stepXp("stay", 3, 30, scoring)).toBe(0);
    expect(stepXp("down", 1, 30, scoring)).toBe(0);
    expect(stepXp(null, 3, 30, scoring)).toBe(0);
    expect(stepXp("up", 0, 30, scoring)).toBe(0);
  });

  it("a collection can pay nothing at all", () => {
    expect(stepXp("up", 3, 0, scoring)).toBe(0);
  });
});
