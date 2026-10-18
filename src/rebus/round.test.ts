import { describe, expect, it } from "vitest";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { makeRng, shuffled } from "./rng";
import { buildRound } from "./round";
import { recordSeen, SEEN_CAP, seenSet } from "./seen";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import type { Puzzle } from "./types";

const ids = (r: { puzzles: Puzzle[] }) => r.puzzles.map((p) => p.id);

describe("rng", () => {
  it("replays the same sequence for a seed", () => {
    const a = makeRng("koda");
    const b = makeRng("koda");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays between 0 and 1, and shuffling keeps every item", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect([...shuffled(makeRng(1), [1, 2, 3, 4, 5])].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("buildRound", () => {
  it("builds the same round for the same seed, and a different one for another", () => {
    const req = { category: "food", count: 5, seed: "room-1" } as const;
    expect(ids(buildRound(SAMPLE_PUZZLES, req))).toEqual(ids(buildRound(SAMPLE_PUZZLES, req)));
    const other = buildRound(SAMPLE_PUZZLES, { ...req, seed: "room-2" });
    expect(new Set(ids(other))).toEqual(new Set(ids(buildRound(SAMPLE_PUZZLES, req))));
  });

  it("takes only the chosen category", () => {
    const round = buildRound(SAMPLE_PUZZLES, { category: "countries", count: 5, seed: 1 });
    expect(round.puzzles).toHaveLength(5);
    expect(round.puzzles.every((p) => p.category === "countries")).toBe(true);
    expect(round.shortBy).toBe(0);
  });

  it("goes easy to hard", () => {
    for (let s = 0; s < 30; s++) {
      const d = buildRound(SAMPLE_PUZZLES, { category: "sayings", count: 5, seed: s }).puzzles.map((p) => p.difficulty);
      expect(d).toEqual([...d].sort());
    }
  });

  it("says how short it is when the bank is too small, rather than inventing puzzles", () => {
    const round = buildRound(SAMPLE_PUZZLES, { category: "food", count: 8, seed: 1 });
    expect(round.puzzles).toHaveLength(5);
    expect(round.shortBy).toBe(3);
  });

  it("keeps puzzles the child has not met ahead of ones they have", () => {
    const seen = new Set(SAMPLE_PUZZLES.filter((p) => p.category === "food").slice(0, 3).map((p) => p.id));
    const fresh = buildRound(SAMPLE_PUZZLES, { category: "food", count: 2, seed: 1, seen });
    expect(fresh.puzzles.every((p) => !seen.has(p.id))).toBe(true);
  });

  it("tops up with seen puzzles when there are not enough new ones, so a round is never needlessly short", () => {
    const foods = SAMPLE_PUZZLES.filter((p) => p.category === "food");
    const seen = new Set(foods.slice(0, 4).map((p) => p.id));
    const round = buildRound(SAMPLE_PUZZLES, { category: "food", count: 5, seed: 1, seen });
    expect(round.puzzles).toHaveLength(5);
    expect(round.puzzles.filter((p) => seen.has(p.id))).toHaveLength(4);
  });

  it("leaves out puzzles that are too old or too young for the child, within a year", () => {
    const young = buildRound(SAMPLE_PUZZLES, { category: "sayings", count: 5, seed: 1, age: 7 });
    expect(young.puzzles.every((p) => p.ages[0] <= 8)).toBe(true);
    const everyone = buildRound(SAMPLE_PUZZLES, { category: "sayings", count: 5, seed: 1, age: null });
    expect(everyone.puzzles).toHaveLength(5);
  });

  it("never serves two puzzles with the same answer", () => {
    const twin: Puzzle = { ...SAMPLE_PUZZLES[7], id: "twin", answer: "HOTDOG" };
    const round = buildRound([...SAMPLE_PUZZLES, twin], { category: "food", count: 5, seed: 3 });
    const answers = round.puzzles.map((p) => p.answer.toLowerCase().replace(/\s/g, ""));
    expect(new Set(answers).size).toBe(answers.length);
    expect(round.puzzles).toHaveLength(5);
  });

  it("mixes categories in a mixed round instead of drawing them all from one", () => {
    const round = buildRound(SAMPLE_PUZZLES, { category: "mixed", count: 6, seed: 4 });
    expect(round.puzzles).toHaveLength(6);
    expect(new Set(round.puzzles.map((p) => p.category)).size).toBe(3);
  });
});

describe("seen log", () => {
  it("moves a puzzle met again to the newest end, without duplicating it", () => {
    expect(recordSeen(["a", "b", "c"], ["b", "d", "d"])).toEqual(["a", "c", "b", "d"]);
  });

  it("forgets the oldest past its cap", () => {
    expect(recordSeen(["a", "b", "c"], ["d", "e"], 4)).toEqual(["b", "c", "d", "e"]);
    expect(recordSeen([], Array.from({ length: SEEN_CAP + 5 }, (_, i) => `p${i}`))).toHaveLength(SEEN_CAP);
  });

  it("makes a set a round can use", () => {
    expect(seenSet(["a", "b"]).has("a")).toBe(true);
  });
});

describe("normalizeSettings", () => {
  it("falls back to the defaults for nothing, or for rubbish", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ hintDelaySec: "fast" })).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps what the owner can set to values a game can run on", () => {
    const s = normalizeSettings({ hintDelaySec: 0, puzzleLimitSec: 9999, hintRungs: 9, maxPlayers: 1 });
    expect(s).toMatchObject({ hintDelaySec: 3, puzzleLimitSec: 120, hintRungs: 3, maxPlayers: 2 });
  });

  it("clamps the points and the Rebus XP, and treats anything that is not a number as 'follow the deployment'", () => {
    expect(normalizeSettings({ pointsPerPuzzle: 99, hintCost: -4, machinePoints: 0 })).toMatchObject({ pointsPerPuzzle: 10, hintCost: 0, machinePoints: 1 });
    expect(normalizeSettings({}).xpPerRound).toBeNull();
    expect(normalizeSettings({ xpPerRound: null }).xpPerRound).toBeNull();
    expect(normalizeSettings({ xpPerRound: "lots" }).xpPerRound).toBeNull();
    expect(normalizeSettings({ xpPerRound: 0 }).xpPerRound).toBe(0);
    expect(normalizeSettings({ xpPerRound: 35.4 }).xpPerRound).toBe(35);
    expect(normalizeSettings({ xpPerRound: 9999 }).xpPerRound).toBe(200);
  });

  it("keeps a valid lock, drops an invalid one, and tidies the question choices", () => {
    expect(normalizeSettings({ machineLock: 2 }).machineLock).toBe(2);
    expect(normalizeSettings({ machineLock: 5 }).machineLock).toBe("free");
    expect(normalizeSettings({ questionChoices: [10, 5, 5, 99, "x"] }).questionChoices).toEqual([5, 10]);
    expect(normalizeSettings({ questionChoices: [] }).questionChoices).toEqual([5, 7, 10]);
  });
});
