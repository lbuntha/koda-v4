import { describe, expect, it } from "vitest";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { lastPlayOf, matchesStatus, recordPlay } from "./results";
import { buildRound, filterPuzzles } from "./round";

describe("results", () => {
  it("calls a first-try win clean, a win with help helped, and anything else missed", () => {
    expect(lastPlayOf({ winner: "child", hintsUsed: 0, wrong: 0 })).toBe("clean");
    expect(lastPlayOf({ winner: "child", hintsUsed: 1, wrong: 0 })).toBe("helped");
    expect(lastPlayOf({ winner: "child", hintsUsed: 0, wrong: 2 })).toBe("helped");
    expect(lastPlayOf({ winner: "machine", hintsUsed: 0, wrong: 0 })).toBe("missed");
    expect(lastPlayOf({ winner: "none", hintsUsed: 0, wrong: 0 })).toBe("missed");
  });

  it("counts plays, keeps the latest result, and forgets the oldest past the cap", () => {
    let r = recordPlay({}, "a", "missed");
    r = recordPlay(r, "a", "clean");
    expect(r.a).toEqual({ plays: 2, last: "clean" });
    r = recordPlay(recordPlay(r, "b", "clean", 2), "c", "clean", 2);
    expect(Object.keys(r)).toEqual(["b", "c"]);
  });

  it("filters by history", () => {
    expect(matchesStatus(undefined, "new")).toBe(true);
    expect(matchesStatus({ plays: 1, last: "helped" }, "retry")).toBe(true);
    expect(matchesStatus({ plays: 1, last: "clean" }, "retry")).toBe(false);
    expect(matchesStatus({ plays: 1, last: "clean" }, "clean")).toBe(true);
  });
});

describe("play all", () => {
  const category = "food" as const;
  const science = SAMPLE_PUZZLES.filter((p) => p.category === category);
  const base = { category, count: 2, all: true } as const;

  it("works through the whole set in rounds, never repeating one, then starts a new pass", () => {
    expect(science.length).toBeGreaterThan(3);
    const first = buildRound(SAMPLE_PUZZLES, { ...base, seed: 1 });
    expect(first.puzzles).toHaveLength(2);
    expect(first.total).toBe(science.length);
    expect(first.remaining).toBe(science.length - 2);
    const done = new Set(first.puzzles.map((p) => p.id));
    const second = buildRound(SAMPLE_PUZZLES, { ...base, seed: 2, done });
    expect(second.puzzles.every((p) => !done.has(p.id))).toBe(true);
    const everything = new Set(science.map((p) => p.id));
    const fresh = buildRound(SAMPLE_PUZZLES, { ...base, seed: 3, done: everything });
    expect(fresh.puzzles).toHaveLength(2);
  });

  it("only plays what the filter lets through", () => {
    const hard = filterPuzzles(SAMPLE_PUZZLES, { category, difficulty: 1 });
    expect(hard.length).toBeGreaterThan(0);
    const round = buildRound(SAMPLE_PUZZLES, { ...base, count: 10, seed: 1, difficulty: 1 });
    expect(round.puzzles.map((p) => p.id).sort()).toEqual(hard.map((p) => p.id).sort());
    expect(round.puzzles.every((p) => p.difficulty === 1)).toBe(true);
  });
});
