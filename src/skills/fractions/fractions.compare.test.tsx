import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  BENCHMARK_WORDS,
  VERDICT_WORDS,
  buildCompareQuestion,
  compareBlockedBecause,
  matched,
  verdictFor,
  verdictsFor,
  type CompareMode,
  type CompareQuestion,
} from "./internal/data/fractionCompare";
import { gcd, lcm, valueOf } from "./internal/data/fractionNumbers";

/** The five comparison techniques, each driven the way a child drives it. */

const compare = skill.activities.compare;

const questions = (mode: CompareMode, n = 200): CompareQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildCompareQuestion({ mode }, mode, i, seen));
};

/** Answer the way the bars say. */
const judge = async (h: ActivityHarness): Promise<void> => {
  const match = h.buttons().find((b) => /^Make the pieces match$/.test(b));
  if (match) await h.press(match);
  const bars = h.screen.getByTestId("bars").textContent ?? "";
  const nums = [...bars.matchAll(/(\d+)\/(\d+)/g)].map((m) => Number(m[1]) / Number(m[2]));
  const [a, b] = nums;
  const word = a < b ? VERDICT_WORDS.less : a > b ? VERDICT_WORDS.more : VERDICT_WORDS.same;
  await h.press(word);
};

describe("the verdict follows the values, not the digits", () => {
  it("is right for every drawn pair of the same whole", () => {
    for (const mode of ["same_denominator", "same_numerator", "common_denominator"] as CompareMode[]) {
      for (const q of questions(mode, 120)) {
        const truth = valueOf(q.left) < valueOf(q.right) ? "less" : valueOf(q.left) > valueOf(q.right) ? "more" : "same";
        expect(q.expected, `${mode}: ${q.left.taken}/${q.left.parts} vs ${q.right.taken}/${q.right.parts}`).toBe(truth);
      }
    }
  });

  it("never draws two fractions worth the same where a verdict is wanted", () => {
    for (const mode of ["same_denominator", "same_numerator", "common_denominator"] as CompareMode[]) {
      for (const q of questions(mode, 80)) {
        expect(valueOf(q.left)).not.toBe(valueOf(q.right));
      }
    }
  });
});

describe("same_denominator — where counting works", () => {
  it("always cuts both bars the same way", () => {
    for (const q of questions("same_denominator")) {
      expect(q.left.parts).toBe(q.right.parts);
      expect(q.left.whole.name).toBe(q.right.whole.name);
    }
  });

  it("offers no 'cannot tell', because you can", () => {
    for (const q of questions("same_denominator", 40)) {
      expect(q.offersCannotTell).toBe(false);
      expect(verdictsFor(q)).toEqual(["less", "same", "more"]);
    }
  });
});

describe("same_numerator — the level that exists for 1/8 > 1/4", () => {
  it("always gives the same number of pieces and different sizes", () => {
    for (const q of questions("same_numerator")) {
      expect(q.left.taken).toBe(q.right.taken);
      expect(q.left.parts).not.toBe(q.right.parts);
    }
  });

  it("makes the bigger bottom number always the smaller fraction", () => {
    // The belief under test, stated as its own contradiction.
    for (const q of questions("same_numerator", 120)) {
      const biggerBottom = q.left.parts > q.right.parts ? "left" : "right";
      const biggerValue = valueOf(q.left) > valueOf(q.right) ? "left" : "right";
      expect(biggerBottom, `${q.left.taken}/${q.left.parts} vs ${q.right.taken}/${q.right.parts}`).not.toBe(
        biggerValue,
      );
    }
  });

  it("names the belief when a child acts on it", async () => {
    const h = renderActivity(compare, { params: { question: { mode: "same_numerator" } } });
    const bars = h.screen.getByTestId("bars").textContent ?? "";
    const nums = [...bars.matchAll(/(\d+)\/(\d+)/g)].map((m) => Number(m[1]) / Number(m[2]));
    // Deliberately answer the wrong way round.
    const wrong = nums[0] < nums[1] ? VERDICT_WORDS.more : VERDICT_WORDS.less;
    await h.press(wrong);
    expect(h.text()).toContain("a bigger bottom number makes the pieces smaller");
    h.unmount();
  });
});

describe("different_wholes — the question that cannot be answered", () => {
  it("always draws two different wholes", () => {
    for (const q of questions("different_wholes")) {
      expect(q.left.whole.name).not.toBe(q.right.whole.name);
    }
  });

  it("wants 'you cannot tell', and offers it", () => {
    for (const q of questions("different_wholes", 80)) {
      expect(q.expected).toBe("cannot-tell");
      expect(q.offersCannotTell).toBe(true);
      expect(verdictsFor(q)).toContain("cannot-tell");
    }
  });

  it("is the only mode that offers it", () => {
    for (const mode of ["same_denominator", "same_numerator", "benchmark_half", "common_denominator"] as CompareMode[]) {
      for (const q of questions(mode, 30)) expect(q.offersCannotTell, mode).toBe(false);
    }
  });

  it("accepts it and explains why", async () => {
    const h = renderActivity(compare, { params: { question: { mode: "different_wholes" } } });
    await h.press(VERDICT_WORDS["cannot-tell"]);
    expect(h.text()).toContain("two different things");
    h.unmount();
  });
});

describe("benchmark_half — measured against a half, not another fraction", () => {
  it("compares against one half every time", () => {
    for (const q of questions("benchmark_half", 120)) {
      expect(q.benchmark).toMatchObject({ parts: 2, taken: 1 });
      expect(q.right).toMatchObject({ parts: 2, taken: 1 });
    }
  });

  it("keeps the fraction close enough that a glance will not do", () => {
    // At most one piece either side of a half — and only half a piece where the
    // denominator is odd, because that is as close as it can get.
    for (const q of questions("benchmark_half", 200)) {
      const half = q.left.parts / 2;
      expect(Math.abs(q.left.taken - half), `${q.left.taken}/${q.left.parts}`).toBeLessThanOrEqual(1);
    }
  });

  it("asks for 'exactly a half' sometimes, and only where one exists", () => {
    const drawn = questions("benchmark_half", 200);
    const exact = drawn.filter((q) => q.expected === "same");
    expect(exact.length).toBeGreaterThan(0);
    for (const q of exact) {
      expect(q.left.parts % 2, `${q.left.taken}/${q.left.parts}`).toBe(0);
      expect(q.left.taken * 2).toBe(q.left.parts);
    }
  });

  it("words the answers as a comparison with a half", () => {
    const h = renderActivity(compare, { params: { question: { mode: "benchmark_half" } } });
    expect(h.buttons()).toEqual(expect.arrayContaining([BENCHMARK_WORDS.less, BENCHMARK_WORDS.more]));
    h.unmount();
  });
});

describe("common_denominator — match before you count", () => {
  it("always draws unlike denominators", () => {
    for (const q of questions("common_denominator")) {
      expect(q.left.parts).not.toBe(q.right.parts);
      expect(q.mustMatch).toBe(true);
      expect(q.common).toBe(lcm(q.left.parts, q.right.parts));
    }
  });

  it("mixes nested denominators with coprime ones", () => {
    const drawn = questions("common_denominator", 40);
    const nested = drawn.filter((q) => q.left.parts % q.right.parts === 0 || q.right.parts % q.left.parts === 0);
    const coprime = drawn.filter((q) => gcd(q.left.parts, q.right.parts) === 1);
    expect(nested.length).toBeGreaterThan(0);
    expect(coprime.length).toBeGreaterThan(0);
  });

  it("re-cuts both to the same denominator without changing either value", () => {
    for (const q of questions("common_denominator", 100)) {
      const m = matched(q);
      expect(m.left.parts).toBe(m.right.parts);
      expect(valueOf(m.left)).toBeCloseTo(valueOf(q.left), 10);
      expect(valueOf(m.right)).toBeCloseTo(valueOf(q.right), 10);
    }
  });

  it("refuses a verdict while the pieces are different sizes", () => {
    const [q] = questions("common_denominator", 1);
    expect(compareBlockedBecause(q, false)).toBe("pieces-differ");
    expect(compareBlockedBecause(q, true)).toBe(null);
  });

  it("says so rather than taking a lucky guess", async () => {
    const h = renderActivity(compare, { params: { question: { mode: "common_denominator" } } });
    await h.press(VERDICT_WORDS.more);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("The pieces are different sizes.");
    h.unmount();
  });

  it("gates nothing else", () => {
    for (const mode of ["same_denominator", "same_numerator", "different_wholes", "benchmark_half"] as CompareMode[]) {
      const [q] = questions(mode, 1);
      expect(compareBlockedBecause(q, false), mode).toBe(null);
    }
  });
});

describe("the bars are the same length wherever looking is a method", () => {
  it("keeps both wholes identical except where the level is about that", () => {
    for (const mode of ["same_denominator", "same_numerator", "common_denominator"] as CompareMode[]) {
      for (const q of questions(mode, 60)) {
        expect(q.left.whole.name, mode).toBe(q.right.whole.name);
      }
    }
  });
});

describe("the round loop", () => {
  it("runs a full five-question round", async () => {
    await expectStandardRound(compare, judge, {
      params: { question: { mode: "same_denominator", partsRange: [4, 8] } },
      questions: 5,
    });
  });

  it("runs one where the pieces have to be matched first", async () => {
    await expectStandardRound(compare, judge, {
      params: { question: { mode: "common_denominator", partsRange: [2, 6] } },
      questions: 5,
    });
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(compare, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

describe("verdictFor", () => {
  it("is the one place the direction is decided", () => {
    const bar = { kind: "bar" as const, name: "the strip" };
    expect(verdictFor({ whole: bar, parts: 8, taken: 3 }, { whole: bar, parts: 8, taken: 5 })).toBe("less");
    expect(verdictFor({ whole: bar, parts: 4, taken: 3 }, { whole: bar, parts: 8, taken: 6 })).toBe("same");
    expect(verdictFor({ whole: bar, parts: 4, taken: 1 }, { whole: bar, parts: 8, taken: 1 })).toBe("more");
  });
});
