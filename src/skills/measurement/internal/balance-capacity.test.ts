import { describe, expect, it } from "vitest";
import { FAIR_PAIRS, MASS_THINGS, MAX_TILT, MIN_RATIO, TRICK_PAIRS, buildBalance, compareTilt, tilt } from "./balance";
import { CUPS_IN, CUSTOMARY_FACTS, VESSEL_SHAPE, buildCapacity, customaryChoices, jugSpec } from "./capacity";

const N = 500;

/* Hand-written facts, so the tables are checked against something other than themselves. */
describe("US customary capacity", () => {
  it("matches the textbook facts", () => {
    expect(CUPS_IN.pint / CUPS_IN.cup).toBe(2);
    expect(CUPS_IN.quart / CUPS_IN.pint).toBe(2);
    expect(CUPS_IN.quart / CUPS_IN.cup).toBe(4);
    expect(CUPS_IN.gallon / CUPS_IN.quart).toBe(4);
    expect(CUPS_IN.gallon / CUPS_IN.pint).toBe(8);
    expect(CUPS_IN.gallon / CUPS_IN.cup).toBe(16);
  });

  it("asks only facts whose answers are whole", () => {
    for (const f of CUSTOMARY_FACTS) expect(Number.isInteger(CUPS_IN[f.big] / CUPS_IN[f.small])).toBe(true);
  });

  it("answers how-many and which-holds-more correctly", () => {
    const facts: Record<string, number> = { "pint/cup": 2, "quart/pint": 2, "quart/cup": 4, "gallon/quart": 4, "gallon/pint": 8 };
    const order = ["cup", "pint", "quart", "gallon"];
    for (let i = 0; i < N; i += 1) {
      const q = buildCapacity({}, "customary", new Set());
      if (q.kind === "howMany") expect(Number(q.answer)).toBe(facts[`${q.big}/${q.small}`]);
      else expect(q.answer).toBe(order.indexOf(q.big!) > order.indexOf(q.small!) ? q.big : q.small);
      if (q.kind === "which") expect(q.big).not.toBe(q.small);
    }
  });

  it("offers four different choices including the answer", () => {
    for (const a of [2, 4, 8, 16]) {
      const c = customaryChoices(a);
      expect(c).toContain(a);
      expect(new Set(c).size).toBe(4);
    }
  });
});

describe("pan balance questions", () => {
  it("pairs only things at least 3 times apart in mass", () => {
    for (const [a, b] of FAIR_PAIRS) {
      const [ga, gb] = [MASS_THINGS[a].grams, MASS_THINGS[b].grams];
      expect(Math.max(ga, gb) / Math.min(ga, gb)).toBeGreaterThanOrEqual(MIN_RATIO);
    }
    // The balloon and the rock: the big one is the light one.
    expect(TRICK_PAIRS.some(([a, b]) => [a, b].includes("balloon") && [a, b].includes("rock"))).toBe(true);
  });

  it("answers from the masses, and the beam tips toward the heavier side", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildBalance({}, "compare", new Set());
      const [l, r] = [MASS_THINGS[q.left].grams, MASS_THINGS[q.right!].grams];
      const heavier = l > r ? "left" : "right";
      expect(q.answer).toBe(q.ask === "heavier" ? heavier : heavier === "left" ? "right" : "left");
      expect(Math.sign(compareTilt(q))).toBe(r > l ? 1 : -1);
    }
  });

  it("uses a trick pair often, so bigger-looks-heavier fails", () => {
    let trick = 0;
    for (let i = 0; i < N; i += 1) {
      const q = buildBalance({}, "compare", new Set());
      const bigger = MASS_THINGS[q.left].size > MASS_THINGS[q.right!].size ? q.left : q.right!;
      const heavierThing = MASS_THINGS[q.left].grams > MASS_THINGS[q.right!].grams ? q.left : q.right!;
      if (bigger !== heavierThing) trick += 1;
    }
    expect(trick / N).toBeGreaterThan(0.35);
  });

  it("cube counts stay in range, and the beam is level only at the answer", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildBalance({ minCubes: 2, maxCubes: 9 }, "cubes", new Set());
      expect(q.cubes).toBeGreaterThanOrEqual(2);
      expect(q.cubes).toBeLessThanOrEqual(9);
      for (let c = 0; c <= 12; c += 1) expect(tilt(q.cubes!, c) === 0).toBe(c === q.cubes);
    }
    expect(Math.abs(tilt(0, 100))).toBe(MAX_TILT);
  });
});

describe("water questions", () => {
  it("pour: two different cup counts, one tall and one wide, answer = more cups", () => {
    let tallLess = 0;
    for (let i = 0; i < N; i += 1) {
      const q = buildCapacity({}, "pour", new Set());
      const [a, b] = q.cups!;
      expect(a).not.toBe(b);
      expect(q.answer).toBe(a > b ? "0" : "1");
      expect(new Set(q.vessels!.map((v) => VESSEL_SHAPE[v as keyof typeof VESSEL_SHAPE])).size).toBe(2);
      expect(q.vessels).not.toContain("mug");
      const tallIdx = q.vessels!.findIndex((v) => VESSEL_SHAPE[v as keyof typeof VESSEL_SHAPE] === "tall");
      if (q.cups![tallIdx] < q.cups![1 - tallIdx]) tallLess += 1;
    }
    expect(tallLess / N).toBeGreaterThan(0.45);
  });

  it.each([[100, 100], [50, 100], [25, 100], [250, 500]])("jug step %i: every reading is on a mark, never empty or full", (step, labelEvery) => {
    for (let i = 0; i < N; i += 1) {
      for (const mode of ["jug", "fill"] as const) {
        const q = buildCapacity({ max: 1000, step, labelEvery }, mode, new Set());
        expect(q.ml! % step).toBe(0);
        expect(q.ml).toBeGreaterThan(0);
        expect(q.ml).toBeLessThan(1000);
        expect(q.answer).toBe(String(q.ml));
      }
    }
  });

  it("refuses a jug whose marks do not divide evenly", () => {
    expect(() => jugSpec({ max: 1000, step: 300 })).toThrow();
    expect(() => jugSpec({ max: 1000, step: 50, labelEvery: 75 })).toThrow();
  });
});
