import { describe, expect, it } from "vitest";
import { bankForAge } from "./bank";
import { OFFICIAL_PUZZLES } from "./content";
import { BUILT_IN_CATEGORIES as CATEGORIES } from "./categories";

const full = { puzzles: OFFICIAL_PUZZLES, counts: Object.fromEntries(CATEGORIES.map((c) => [c.id, OFFICIAL_PUZZLES.filter((p) => p.category === c.id).length])) as never, loaded: true };

describe("bankForAge", () => {
  it("keeps only what suits the child, and counts it", () => {
    const seven = bankForAge(full, 7);
    expect(seven.puzzles.length).toBeLessThan(OFFICIAL_PUZZLES.length);
    expect(seven.puzzles.every((p) => p.ages[0] - 1 <= 7)).toBe(true);
    expect(seven.counts.food).toBe(seven.puzzles.filter((p) => p.category === "food").length);
  });

  it("shows an older child the harder puzzles and fewer of them", () => {
    const sixteen = bankForAge(full, 16);
    expect(sixteen.puzzles.length).toBeGreaterThan(0);
    expect(sixteen.puzzles.every((p) => p.difficulty >= 2)).toBe(true);
    expect(sixteen.puzzles.length).toBeLessThan(bankForAge(full, 9).puzzles.length);
  });

  it("shows everything when the age is not known", () => {
    expect(bankForAge(full, null).puzzles).toHaveLength(OFFICIAL_PUZZLES.length);
  });
});
