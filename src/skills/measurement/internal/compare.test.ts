import { describe, expect, it } from "vitest";
import { BENCH, COMPARE_MODES, buildCompare, compareModeAt, drawSizes, farEnough, type CompareQuestion } from "./compare";

const SAMPLES = 400;
const sample = (mode: (typeof COMPARE_MODES)[number], setup = {}): CompareQuestion[] =>
  Array.from({ length: SAMPLES }, () => buildCompare(setup, mode, new Set()));

/* The right answer, worked out here from the sizes alone, never from `answer`. */
function independentAnswer(q: CompareQuestion): string {
  const bySize = [...q.items].sort((a, b) => a.size - b.size);
  if (q.mode === "order") return bySize.map((i) => i.key).join(",");
  const big = bySize[bySize.length - 1].key;
  const small = bySize[0].key;
  return q.ask === "longer" || q.ask === "taller" ? big : small;
}

describe("compare questions", () => {
  it.each(["pick", "pick_vertical", "align", "order", "indirect"] as const)("%s: the answer key matches the sizes", (mode) => {
    for (const q of sample(mode)) expect(q.answer).toBe(independentAnswer(q));
  });

  it.each(["pick", "pick_vertical", "align", "order", "indirect"] as const)("%s: everything fits on the bench, sizes distinct", (mode) => {
    for (const q of sample(mode)) {
      for (const it of q.items) {
        expect(it.size).toBeGreaterThan(0);
        expect(it.start + it.size).toBeLessThanOrEqual(BENCH);
      }
      expect(new Set(q.items.map((i) => i.size)).size).toBe(q.items.length);
    }
  });

  it("pick keeps lengths at least 20% apart, so the eye can judge them", () => {
    for (const q of sample("pick")) expect(farEnough(q.items[0].size, q.items[1].size, 0.2)).toBe(true);
  });

  it("align always starts the shorter one late enough that it looks longer", () => {
    for (const q of sample("align")) {
      const [short, long] = [...q.items].sort((a, b) => a.size - b.size);
      expect(long.start).toBe(0);
      expect(short.start).toBeGreaterThan(0);
      expect(short.start + short.size).toBeGreaterThan(long.size);
    }
  });

  it("pick and order draw the same kind of thing for every item, so only length differs", () => {
    for (const mode of ["pick", "pick_vertical", "order", "align"] as const) {
      for (const q of sample(mode)) expect(new Set(q.items.map((i) => i.thing)).size).toBe(1);
    }
  });

  it("every item in a question has its own colour", () => {
    for (const mode of ["pick", "order", "indirect"] as const) {
      for (const q of sample(mode)) expect(new Set(q.items.map((i) => i.colour)).size).toBe(q.items.length);
    }
  });

  it("attribute questions pair the right tool with the question", () => {
    const tools = { longer: "ruler", shorter: "ruler", heavier: "balance", lighter: "balance", holdsMore: "jug" } as const;
    for (const q of sample("attribute")) expect(q.answer).toBe(tools[q.ask as keyof typeof tools]);
  });

  it("avoids repeating a question within a round while it can", () => {
    const seen = new Set<string>();
    const keys = Array.from({ length: 5 }, () => buildCompare({}, "pick", seen)).map((q) => `${q.ask}:${q.items.map((i) => i.size).join()}`);
    expect(new Set(keys).size).toBe(5);
  });

  it("repeats rather than hangs once a tiny range is used up", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) buildCompare({ minSize: 4, maxSize: 5, minGap: 0.2 }, "pick", seen);
    expect(seen.size).toBeGreaterThan(0);
  });

  it("drawSizes throws for a range that cannot hold the gap", () => {
    expect(() => drawSizes(3, 9, 10, 0.3, () => 0.5)).toThrow();
  });

  it("practice cycles its modes in order", () => {
    const setup = { modes: ["pick", "align", "order"] as const };
    expect([1, 2, 3, 4].map((i) => compareModeAt({ modes: [...setup.modes] }, i))).toEqual(["pick", "align", "order", "pick"]);
    expect(compareModeAt({ mode: "indirect" }, 3)).toBe("indirect");
  });
});
