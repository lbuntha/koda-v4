import { describe, expect, it } from "vitest";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { DEFAULT_POINT_RULES, hintFor, hintState, lettersMask, MIN_POINTS, pointsFor } from "./hints";
import { addResult, averageSeconds, emptyScore, roundOutcome } from "./scoring";

const settings = { hintDelaySec: 15, hintRungs: 3 as const };
const germany = SAMPLE_PUZZLES[0];

describe("lettersMask", () => {
  it("shows each word's first letter and counts the rest", () => {
    expect(lettersMask("Germany")).toBe("G _ _ _ _ _ _  (7 letters)");
    expect(lettersMask("Slice of cake")).toBe("S _ _ _ _   O _   C _ _ _  (11 letters)");
  });

  it("ignores case, punctuation and articles in what it counts", () => {
    expect(lettersMask("A Hot-Dog!")).toBe("H _ _   D _ _  (6 letters)");
  });
});

describe("hintFor", () => {
  it("climbs from the category, to the letters, to the names of the pictures", () => {
    expect(hintFor(germany, 1)).toEqual({ rung: 1, kind: "category", text: "Category: countries" });
    expect(hintFor(germany, 2).text).toBe("Letters: G _ _ _ _ _ _  (7 letters)");
    expect(hintFor(germany, 3)).toEqual({ rung: 3, kind: "pieces", text: "The pieces: germ · money" });
  });

  it("names a stack as one piece and skips the operators", () => {
    expect(hintFor(SAMPLE_PUZZLES[10], 3).text).toBe("The pieces: MAN over BOARD");
  });
});

describe("hintState", () => {
  it("is locked until the owner's delay has passed, with the time left", () => {
    expect(hintState(settings, 0, 100, 100)).toEqual({ state: "locked", secondsLeft: 15 });
    expect(hintState(settings, 0, 100, 110)).toEqual({ state: "locked", secondsLeft: 5 });
  });

  it("is ready at the delay, offering the next rung", () => {
    expect(hintState(settings, 0, 100, 115)).toEqual({ state: "ready", rung: 1 });
    expect(hintState(settings, 2, 140, 160)).toEqual({ state: "ready", rung: 3 });
  });

  it("waits a full delay again after each hint is taken", () => {
    expect(hintState(settings, 1, 115, 120)).toEqual({ state: "locked", secondsLeft: 10 });
  });

  it("stops at the owner's cap on rungs", () => {
    expect(hintState({ hintDelaySec: 15, hintRungs: 2 }, 2, 0, 999)).toEqual({ state: "exhausted" });
  });

  it("follows the delay the owner sets", () => {
    expect(hintState({ hintDelaySec: 5, hintRungs: 3 }, 0, 0, 5)).toEqual({ state: "ready", rung: 1 });
  });
});

describe("pointsFor", () => {
  it("costs a point per hint by default, never below the minimum", () => {
    expect([0, 1, 2, 3, 9].map((n) => pointsFor(n))).toEqual([3, 2, MIN_POINTS, MIN_POINTS, MIN_POINTS]);
    expect(DEFAULT_POINT_RULES).toEqual({ pointsPerPuzzle: 3, hintCost: 1, machinePoints: 3 });
  });

  it("follows what the owner sets: points per puzzle, the cost of a hint, and a hint that is free", () => {
    const rules = { pointsPerPuzzle: 10, hintCost: 3, machinePoints: 5 };
    expect([0, 1, 2, 3, 4, 9].map((n) => pointsFor(n, rules))).toEqual([10, 7, 4, 1, 1, 1]);
    expect([0, 1, 5].map((n) => pointsFor(n, { ...rules, hintCost: 0 }))).toEqual([10, 10, 10]);
  });
});

describe("round score", () => {
  it("adds up wins, hints and time, and the Machine always scores full points", () => {
    let score = emptyScore();
    score = addResult(score, { winner: "child", hintsUsed: 0, seconds: 10 });
    score = addResult(score, { winner: "child", hintsUsed: 2, seconds: 30 });
    score = addResult(score, { winner: "machine", hintsUsed: 1, seconds: 20 });
    score = addResult(score, { winner: "none", hintsUsed: 3, seconds: 60 });
    expect(score).toMatchObject({ child: 4, machine: 3, childWins: 2, machineWins: 1, solved: 2, hintsUsed: 6, puzzles: 4 });
    expect(averageSeconds(score)).toBe(30);
    expect(roundOutcome(score)).toBe("child");
  });

  it("scores with the owner's points, for the child and for the Machine", () => {
    const rules = { pointsPerPuzzle: 6, hintCost: 2, machinePoints: 4 };
    let score = emptyScore();
    score = addResult(score, { winner: "child", hintsUsed: 1, seconds: 10 }, rules);
    score = addResult(score, { winner: "machine", hintsUsed: 0, seconds: 10 }, rules);
    expect(score).toMatchObject({ child: 4, machine: 4 });
  });

  it("calls a tie a tie, and averages an empty round as zero", () => {
    expect(roundOutcome(emptyScore())).toBe("tie");
    expect(averageSeconds(emptyScore())).toBe(0);
  });
});
