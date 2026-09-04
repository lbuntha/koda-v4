import { describe, expect, it } from "vitest";
import {
  crossesBoundary,
  differenceKey,
  digitsOf,
  drawConstantDifference,
  drawDifference,
  drawRoundingDifference,
  drawSubtractionStory,
  exchangesIn,
  isRegrouping,
  roundTo,
  satisfiesDifference,
  withoutRepeat,
  type DifferenceSpec,
  type StoryKind,
} from "./internal/data/subtractionNumbers";

const DRAWS = 200;
const times = (count: number, run: () => void) => {
  for (let i = 0; i < count; i += 1) run();
};

describe("subtraction place value", () => {
  it("splits a number into hundreds, tens, and ones", () => {
    expect(digitsOf(407)).toEqual({ ones: 7, tens: 0, hundreds: 4 });
  });

  it("finds a single exchange into ones", () => {
    expect(exchangesIn(52, 18)).toEqual([
      { from: "tens", to: "ones", acrossZero: false },
    ]);
  });

  it("finds two cascading exchanges", () => {
    expect(exchangesIn(352, 178)).toEqual([
      { from: "tens", to: "ones", acrossZero: false },
      { from: "hundreds", to: "tens", acrossZero: false },
    ]);
  });

  it("shows every step of an exchange across zero", () => {
    expect(exchangesIn(402, 185)).toEqual([
      { from: "hundreds", to: "tens", acrossZero: true },
      { from: "tens", to: "ones", acrossZero: true },
    ]);
  });

  it("does not exchange clean columns", () => {
    expect(exchangesIn(87, 42)).toEqual([]);
    expect(isRegrouping(87, 42)).toBe(false);
  });

  it("rejects an exchange for a negative-result question", () => {
    expect(() => exchangesIn(4, 7)).toThrow(/minuend >= subtrahend/);
  });
});

describe("drawDifference honours every declared lesson shape", () => {
  const specs: Record<string, DifferenceSpec> = {
    "take away within ten": {
      minuendRange: [2, 10],
      subtrahendRange: [1, 9],
      differenceRange: [1, 9],
      excludeEqual: true,
    },
    "count back a small subtrahend": {
      minuendRange: [4, 15],
      subtrahendRange: [1, 3],
      smallSubtrahend: true,
    },
    "subtract zero": { minuendRange: [0, 20], subtrahendRange: [0, 0] },
    "subtract all": { minuendRange: [1, 20], differenceRange: [0, 0] },
    "recall a partner of five": { minuendRange: [5, 5], subtrahendRange: [1, 4] },
    "recall a partner of ten": { minuendRange: [10, 10], subtrahendRange: [1, 9] },
    "fact family with two different parts": {
      minuendRange: [3, 18],
      subtrahendRange: [1, 9],
      differenceRange: [1, 9],
      excludeEqual: true,
      distinctParts: true,
    },
    "think addition within twenty": {
      minuendRange: [3, 20],
      subtrahendRange: [1, 19],
      differenceRange: [1, 19],
      excludeEqual: true,
    },
    "a fact worth deriving from a neighbour": {
      minuendRange: [5, 20],
      subtrahendRange: [2, 18],
      differenceRange: [1, 18],
      excludeEqual: true,
    },
    "count up across a small difference": {
      minuendRange: [10, 100],
      subtrahendRange: [1, 99],
      differenceRange: [1, 10],
      smallDifference: true,
    },
    "bridge through ten": {
      minuendRange: [11, 19],
      subtrahendRange: [2, 9],
      differenceRange: [1, 9],
      crossBoundary: 10,
    },
    "bridge through a hundred": {
      minuendRange: [101, 199],
      subtrahendRange: [2, 99],
      differenceRange: [2, 99],
      crossBoundary: 100,
    },
    "compensation with an almost-round subtrahend": {
      minuendRange: [30, 99],
      subtrahendRange: [18, 79],
      subtrahendEndsIn: [8, 9],
      excludeEqual: true,
    },
    "clean three-digit columns": {
      minuendRange: [200, 999],
      subtrahendRange: [100, 888],
      exchange: "never",
      excludeEqual: true,
    },
    "clean two-digit columns": {
      minuendRange: [20, 99],
      subtrahendRange: [10, 88],
      exchange: "never",
      excludeEqual: true,
    },
    "multiples of ten": {
      minuendRange: [20, 100],
      subtrahendRange: [10, 90],
      multipleOf: 10,
      excludeEqual: true,
    },
    "multiples of a hundred": {
      minuendRange: [200, 900],
      subtrahendRange: [100, 900],
      multipleOf: 100,
      excludeEqual: true,
    },
    "exchange one ten": {
      minuendRange: [20, 99],
      subtrahendRange: [11, 88],
      exchange: "ones",
    },
    "exchange one hundred": {
      minuendRange: [200, 999],
      subtrahendRange: [100, 899],
      exchange: "tens",
    },
    "two cascading exchanges": {
      minuendRange: [200, 999],
      subtrahendRange: [111, 899],
      exchange: "both",
    },
    "regroup across zero": {
      minuendRange: [200, 909],
      subtrahendRange: [101, 899],
      exchange: "across_zero",
    },
  };

  for (const [name, spec] of Object.entries(specs)) {
    it(name, () => {
      times(DRAWS, () => {
        const value = drawDifference(spec);
        expect(
          satisfiesDifference(value, spec),
          `${value.minuend} - ${value.subtrahend} violates ${name}`,
        ).toBe(true);
        expect(value.minuend).toBeGreaterThanOrEqual(value.subtrahend);
        expect(value.difference).toBe(value.minuend - value.subtrahend);
      });
    });
  }

  it("rejects equal parts for a four-fact family", () => {
    const doubles = { minuend: 8, subtrahend: 4, difference: 4 };
    expect(satisfiesDifference(doubles, {})).toBe(true);
    expect(satisfiesDifference(doubles, { distinctParts: true })).toBe(false);
    expect(satisfiesDifference({ minuend: 8, subtrahend: 3, difference: 5 }, { distinctParts: true })).toBe(true);
  });

  it("throws when no question can satisfy the authoring constraints", () => {
    expect(() => drawDifference({
      minuendRange: [1, 5],
      subtrahendRange: [8, 9],
    })).toThrow(/no difference satisfies/);
  });

  it("uses its deterministic fallback to find a lone legal question", () => {
    expect(drawDifference({
      minuendRange: [1, 60],
      subtrahendRange: [1, 60],
      differenceRange: [59, 59],
    })).toEqual({ minuend: 60, subtrahend: 1, difference: 59 });
  });
});

describe("strategy invariants", () => {
  it("recognises crossing ten and hundred boundaries", () => {
    expect(crossesBoundary(14, 6, 10)).toBe(true);
    expect(crossesBoundary(14, 3, 10)).toBe(false);
    expect(crossesBoundary(132, 47, 100)).toBe(true);
  });

  it("keeps the same difference when both operands move", () => {
    times(DRAWS, () => {
      const value = drawConstantDifference({
        minuendRange: [30, 99],
        subtrahendRange: [11, 79],
        excludeEqual: true,
      });
      expect(value.adjustedSubtrahend % 10).toBe(0);
      expect(value.adjustedMinuend - value.adjustedSubtrahend).toBe(value.difference);
      expect(value.adjustedMinuend).toBe(value.minuend + value.offset);
    });
  });

  /*
   * An estimate of zero for a difference of forty-six is not a rough answer,
   * it is a wrong one. 297 − 251 rounded to hundreds gave exactly that, and
   * the round marked "about 0" correct.
   */
  it("never rounds both operands to the same place", () => {
    times(DRAWS, () => {
      for (const [digits, unit] of [[2, 10], [3, 100]] as const) {
        const value = drawRoundingDifference(digits);
        const estimate = roundTo(value.minuend, unit) - roundTo(value.subtrahend, unit);
        expect(estimate, `${value.minuend} − ${value.subtrahend} estimates as ${estimate}`)
          .toBeGreaterThanOrEqual(unit);
      }
    });
  });

  it("draws ordered operands that are worth rounding", () => {
    times(DRAWS, () => {
      const two = drawRoundingDifference(2);
      expect(two.minuend).toBeGreaterThanOrEqual(two.subtrahend);
      expect(two.minuend % 10).not.toBe(0);
      expect(two.subtrahend % 10).not.toBe(0);
      expect(two.minuend % 10).not.toBe(5);
      expect(two.subtrahend % 10).not.toBe(5);

      const three = drawRoundingDifference(3);
      expect(three.minuend).toBeGreaterThanOrEqual(three.subtrahend);
      expect(three.minuend % 100).not.toBe(0);
      expect(three.subtrahend % 100).not.toBe(0);
      expect(three.minuend % 100).not.toBe(50);
      expect(three.subtrahend % 100).not.toBe(50);
    });
  });

  it("rounds to the nearer unit", () => {
    expect(roundTo(47, 10)).toBe(50);
    expect(roundTo(43, 10)).toBe(40);
    expect(roundTo(347, 100)).toBe(300);
    expect(roundTo(386, 100)).toBe(400);
  });
});

describe("subtraction story unknowns", () => {
  const kinds: StoryKind[] = [
    "remove_result",
    "remove_change",
    "remove_start",
    "compare_difference",
    "compare_bigger",
    "compare_smaller",
    "multi_step",
  ];

  it.each(kinds)("%s always carries the answer implied by its stated values", (kind) => {
    times(DRAWS, () => {
      const story = drawSubtractionStory(kind);
      switch (kind) {
        case "remove_result":
          expect(story.answer).toBe(story.values[0] - story.values[1]);
          break;
        case "remove_change":
          expect(story.answer).toBe(story.values[0] - story.values[1]);
          break;
        case "remove_start":
          expect(story.answer).toBe(story.values[0] + story.values[1]);
          break;
        case "compare_difference":
          expect(story.answer).toBe(story.values[1] - story.values[0]);
          break;
        case "compare_bigger":
          expect(story.answer).toBe(story.values[0] + story.values[1]);
          break;
        case "compare_smaller":
          expect(story.answer).toBe(story.values[0] - story.values[1]);
          break;
        case "multi_step":
          expect(story.steps).toHaveLength(2);
          expect(story.intermediate).toBe(story.steps![0].result);
          expect(story.answer).toBe(story.steps![1].result);
          expect(story.answer).toBeGreaterThanOrEqual(0);
          break;
      }
    });
  });
});

describe("withoutRepeat", () => {
  it("keeps five questions distinct when the space permits", () => {
    const seen = new Set<string>();
    const asked = Array.from({ length: 5 }, () => {
      const value = withoutRepeat(
        () => drawDifference({ minuendRange: [5, 10], subtrahendRange: [1, 4] }),
        differenceKey,
        seen,
      );
      return differenceKey(value);
    });
    expect(new Set(asked).size).toBe(5);
  });

  it("returns instead of hanging when the space is exhausted", () => {
    const seen = new Set<string>();
    const draw = () => drawDifference({ minuendRange: [2, 2], subtrahendRange: [1, 2] });
    expect(() => times(5, () => withoutRepeat(draw, differenceKey, seen))).not.toThrow();
  });
});
