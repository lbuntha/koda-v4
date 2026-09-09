import { describe, expect, it } from "vitest";
import {
  MAX_ARRAY_CELLS,
  MAX_ARRAY_SIDE,
  carriesIn,
  digitCount,
  digitProducts,
  digitsOf,
  drawArray,
  drawColumnProduct,
  drawEstimateProduct,
  drawFactSplit,
  drawFactorNumber,
  drawHalveDouble,
  drawMissingDimension,
  drawHopRun,
  drawMultipleQuestion,
  drawMultiplicationStory,
  drawPartialProduct,
  drawProduct,
  drawTriple,
  factKey,
  factorPairsOf,
  hopKey,
  hopSteps,
  hasNoZeroDigit,
  isPrime,
  partialProductsOf,
  placeValueSplit,
  productDistractors,
  productKey,
  roundTo,
  satisfiesArray,
  satisfiesHopRun,
  satisfiesProduct,
  withoutRepeat,
  type ProductSpec,
  type StoryKind,
} from "./internal/data/multiplicationNumbers";
import {
  FACTOR_LEVEL,
  HELPER_FACTS,
  PARTNER_MAX,
  PARTNER_MIN,
  applyAdjust,
  availableAt,
  derivedProduct,
  factLevel,
  factsForStrategy,
  helperFor,
  helpersArriveFirst,
  productOf,
  strategiesFor,
  type FactStrategy,
} from "./internal/data/helperFacts";

const DRAWS = 200;
const times = (count: number, run: () => void) => {
  for (let i = 0; i < count; i += 1) run();
};

/* -------------------------------------------------------------------------- */

describe("place value", () => {
  it("splits a number into hundreds, tens, and ones", () => {
    expect(digitsOf(407)).toEqual({ ones: 7, tens: 0, hundreds: 4 });
  });

  it("cuts a number into the parts an area model draws", () => {
    expect(placeValueSplit(26)).toEqual([20, 6]);
    expect(placeValueSplit(234)).toEqual([200, 30, 4]);
  });

  it("never returns an empty part, because a zero-wide rectangle is not a part", () => {
    expect(placeValueSplit(205)).toEqual([200, 5]);
    expect(placeValueSplit(70)).toEqual([70]);
  });

  it("recognises a number whose every digit is nonzero", () => {
    expect(hasNoZeroDigit(46)).toBe(true);
    expect(hasNoZeroDigit(40)).toBe(false);
    expect(digitCount(407)).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */

describe("drawProduct honours every declared lesson shape", () => {
  const specs: Record<string, ProductSpec> = {
    "equal groups within forty": { aRange: [2, 6], bRange: [2, 9], productMax: 40 },
    "times two, including one group": { aRange: [2, 2], bRange: [1, 12], allowOne: true },
    "times nine": { aRange: [9, 9], bRange: [2, 12] },
    "an array that can be turned around": {
      aRange: [2, 10], bRange: [2, 10], distinctFactors: true,
    },
    "multiply by one": { aRange: [1, 1], bRange: [2, 12], allowOne: true },
    "multiply by zero": { aRange: [2, 12], bRange: [0, 0], allowZero: true },
    "a fact inside the twelve times table": { aRange: [2, 12], bRange: [2, 12] },
    "a factor to split": { aRange: [6, 10], bRange: [2, 12] },
  };

  for (const [name, spec] of Object.entries(specs)) {
    it(`satisfies "${name}" on every draw`, () => {
      times(DRAWS, () => {
        const value = drawProduct(spec);
        expect(satisfiesProduct(value, spec)).toBe(true);
        // Checked against multiplication itself, not against what the
        // generator claims it computed.
        expect(value.product).toBe(value.a * value.b);
      });
    });
  }

  it("keeps zero and one out of an ordinary question", () => {
    times(DRAWS, () => {
      const value = drawProduct({ aRange: [0, 9], bRange: [0, 9] });
      expect(value.a).toBeGreaterThan(1);
      expect(value.b).toBeGreaterThan(1);
    });
  });

  it("never draws a square where the two factors must differ", () => {
    times(DRAWS, () => {
      const value = drawProduct({ aRange: [2, 9], bRange: [2, 9], distinctFactors: true });
      expect(value.a).not.toBe(value.b);
    });
  });

  it("respects a product ceiling at the boundary", () => {
    times(DRAWS, () => {
      expect(drawProduct({ aRange: [2, 12], bRange: [2, 12], productMax: 24 }).product)
        .toBeLessThanOrEqual(24);
    });
  });

  it("throws rather than relaxing an impossible specification", () => {
    expect(() => drawProduct({ aRange: [7, 7], bRange: [7, 7], distinctFactors: true }))
      .toThrow(/no product satisfies/);
    expect(() => drawProduct({ aRange: [11, 12], bRange: [11, 12], productMax: 50 }))
      .toThrow(/no product satisfies/);
  });

  it("finds the one legal question in a range random search would miss", () => {
    // Only 3 × 12 and 12 × 3 reach exactly 36 in this range; the scan must find one.
    const value = drawProduct({
      aRange: [3, 12], bRange: [3, 12], productMin: 36, productMax: 36,
    });
    expect(value.product).toBe(36);
  });

  it("separates a question's two identities", () => {
    const one = { a: 3, b: 4, product: 12 };
    const other = { a: 4, b: 3, product: 12 };
    expect(productKey(one)).not.toBe(productKey(other));
    expect(factKey(one)).toBe(factKey(other));
  });
});

/* -------------------------------------------------------------------------- */

describe("arrays fit the apparatus", () => {
  it("never exceeds the side or cell ceiling", () => {
    times(DRAWS, () => {
      const shape = drawArray({ rowRange: [2, 12], colRange: [2, 12] });
      expect(shape.rows).toBeLessThanOrEqual(MAX_ARRAY_SIDE);
      expect(shape.cols).toBeLessThanOrEqual(MAX_ARRAY_SIDE);
      expect(shape.total).toBeLessThanOrEqual(MAX_ARRAY_CELLS);
      expect(shape.total).toBe(shape.rows * shape.cols);
    });
  });

  it("honours a tighter cell budget", () => {
    times(DRAWS, () => {
      expect(drawArray({ rowRange: [2, 10], colRange: [2, 10], maxCells: 30 }).total)
        .toBeLessThanOrEqual(30);
    });
  });

  it("refuses a shape past the apparatus ceiling even when the spec allows it", () => {
    expect(satisfiesArray({ rows: 13, cols: 2, total: 26 }, { rowRange: [2, 13] })).toBe(false);
  });

  it("throws when no array fits", () => {
    expect(() => drawArray({ rowRange: [9, 12], colRange: [9, 12], maxCells: 20 }))
      .toThrow(/no array satisfies/);
  });

  it("always leaves a whole number as the missing side", () => {
    times(DRAWS, () => {
      const shape = drawMissingDimension({ rowRange: [2, 10], colRange: [2, 10] });
      const shown = shape.unknown === "rows" ? shape.cols : shape.rows;
      expect(shape.total % shown).toBe(0);
      expect(shape.total / shown).toBe(shape.answer);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("hops along a line", () => {
  it("always lands where its own hops say it should", () => {
    times(DRAWS, () => {
      const run = drawHopRun();
      expect(run.landing).toBe(run.step * run.hops);
      expect(satisfiesHopRun(run)).toBe(true);
    });
  });

  it("counts only in the lengths a lesson asked for", () => {
    times(DRAWS, () => {
      const run = drawHopRun({ steps: [2, 3, 4, 5, 10], hopRange: [3, 10], max: 100 });
      expect([2, 3, 4, 5, 10]).toContain(run.step);
      expect(run.hops).toBeGreaterThanOrEqual(3);
      expect(run.hops).toBeLessThanOrEqual(10);
      expect(run.landing).toBeLessThanOrEqual(100);
    });
  });

  it("never draws a hop of one, or a run of one hop", () => {
    // A hop of one is counting, and one hop is not a run. Neither is a skip
    // count, and both would score as one while teaching nothing.
    times(DRAWS, () => {
      const run = drawHopRun({ stepRange: [1, 10], hopRange: [1, 10] });
      expect(run.step).toBeGreaterThan(1);
      expect(run.hops).toBeGreaterThan(1);
    });
    expect(satisfiesHopRun({ step: 1, hops: 5, landing: 5 })).toBe(false);
    expect(satisfiesHopRun({ step: 5, hops: 1, landing: 5 })).toBe(false);
    expect(satisfiesHopRun({ step: 5, hops: 3, landing: 20 }), "a landing that is not the product").toBe(false);
  });

  it("prefers a declared set of lengths over a range", () => {
    expect(hopSteps({ steps: [2, 5, 10], stepRange: [2, 9] })).toEqual([2, 5, 10]);
    expect(hopSteps({ stepRange: [3, 6] })).toEqual([3, 4, 5, 6]);
    expect(hopSteps({})).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("finds the one legal run when random search will not", () => {
    // Exactly one run fits: nine hops of nine is eighty-one, and ten of nine
    // is ninety. The deterministic scan is what stops this being a hang.
    const run = drawHopRun({ steps: [9], hopRange: [9, 10], max: 85 });
    expect(run).toEqual({ step: 9, hops: 9, landing: 81 });
  });

  it("refuses a spec that no run satisfies", () => {
    expect(() => drawHopRun({ steps: [10], hopRange: [5, 9], max: 40 })).toThrow(/no hop run/);
    expect(() => drawHopRun({ stepRange: [2, 9], hopRange: [1, 1] })).toThrow(/no hop run/);
  });

  it("treats two runs that land the same way by the same route as one question", () => {
    expect(hopKey({ step: 5, hops: 4, landing: 20 })).toBe(hopKey({ step: 5, hops: 4, landing: 20 }));
    // Four hops of five and five hops of four land together and are not the
    // same question: one is counting in fives, the other in fours.
    expect(hopKey({ step: 5, hops: 4, landing: 20 })).not.toBe(hopKey({ step: 4, hops: 5, landing: 20 }));
  });
});

/* -------------------------------------------------------------------------- */

describe("multiples", () => {
  it("labels every value correctly against its own step", () => {
    times(DRAWS, () => {
      const question = drawMultipleQuestion({ step: 7, max: 120 });
      expect(question.isMultiple).toBe(question.value % 7 === 0);
    });
  });

  it("keeps a non-multiple close enough that size alone cannot answer it", () => {
    times(DRAWS, () => {
      const question = drawMultipleQuestion({ step: 10, max: 120, nearMissDelta: 2 });
      if (question.isMultiple) return;
      const nearest = Math.round(question.value / 10) * 10;
      expect(Math.abs(question.value - nearest)).toBeLessThanOrEqual(2);
    });
  });

  it("refuses a step or a range that holds no question", () => {
    expect(() => drawMultipleQuestion({ step: 1 })).toThrow(/step of 2 or more/);
    expect(() => drawMultipleQuestion({ step: 50, max: 60 })).toThrow(/holds no multiples/);
  });

  it("draws its step from a declared set, so a round is not all one table", () => {
    const drawn = new Set<number>();
    times(DRAWS, () => {
      const question = drawMultipleQuestion({ steps: [3, 7], max: 60 });
      expect([3, 7]).toContain(question.step);
      expect(question.isMultiple).toBe(question.value % question.step === 0);
      drawn.add(question.step);
    });
    expect(drawn.size, "one hundred draws from two steps used only one").toBe(2);
  });
});

/* -------------------------------------------------------------------------- */

describe("splitting a factor", () => {
  it("always cuts into a friendly part the child already owns", () => {
    times(DRAWS, () => {
      const split = drawFactSplit({ aRange: [6, 10], bRange: [2, 12] });
      expect([2, 5, 10]).toContain(split.partA);
      expect(split.partA + split.partB).toBe(split.factor);
      expect(split.partB).toBeGreaterThan(0);
      // The cut preserves the product it claims to.
      expect(split.partA * split.other + split.partB * split.other).toBe(split.product);
    });
  });

  it("throws when no factor in range can be split", () => {
    expect(() => drawFactSplit({ aRange: [2, 2], bRange: [2, 9] }))
      .toThrow(/splits into a friendly part/);
  });
});

/* -------------------------------------------------------------------------- */

describe("area model and partial products", () => {
  it("cuts a product into parts that add back to it", () => {
    expect(partialProductsOf(23, 46).map((part) => part.product)).toEqual([800, 120, 120, 18]);
    const total = partialProductsOf(23, 46).reduce((sum, part) => sum + part.product, 0);
    expect(total).toBe(23 * 46);
  });

  it("adds back to the product for every drawn question", () => {
    times(DRAWS, () => {
      const value = drawPartialProduct({ digitsA: 2, digitsB: 2 });
      const parts = partialProductsOf(value.a, value.b);
      expect(parts.reduce((sum, part) => sum + part.product, 0)).toBe(value.a * value.b);
    });
  });

  it("gives a two-by-two model all four of its parts", () => {
    times(DRAWS, () => {
      const value = drawPartialProduct({ digitsA: 2, digitsB: 2, allPartsNonzero: true });
      const parts = partialProductsOf(value.a, value.b);
      expect(parts).toHaveLength(4);
      for (const part of parts) expect(part.product).toBeGreaterThan(0);
    });
  });

  it("keeps a one-digit multiplier honest", () => {
    times(DRAWS, () => {
      const value = drawPartialProduct({ digitsA: 2, digitsB: 1 });
      expect(digitCount(value.a)).toBe(2);
      expect(digitCount(value.b)).toBe(1);
      expect(value.b).toBeGreaterThan(1);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("the written algorithm", () => {
  it("counts the carries a child actually records", () => {
    expect(carriesIn(23, 3)).toBe(0);
    expect(carriesIn(26, 4)).toBe(2);
    expect(carriesIn(12, 4)).toBe(0);
    expect(digitProducts(23, 4)).toEqual([8, 12]);
  });

  it("draws a no-carry question whose every digit product fits in one column", () => {
    times(DRAWS, () => {
      const value = drawColumnProduct({ digitsA: 2, digitsB: 1, carries: "never" });
      for (const part of digitProducts(value.a, value.b)) expect(part).toBeLessThanOrEqual(9);
      expect(carriesIn(value.a, value.b)).toBe(0);
    });
  });

  it("draws a carrying question that really carries", () => {
    times(DRAWS, () => {
      const value = drawColumnProduct({ digitsA: 3, digitsB: 1, carries: "some" });
      expect(carriesIn(value.a, value.b)).toBeGreaterThanOrEqual(1);
      expect(digitCount(value.a)).toBe(3);
    });
  });

  it("draws a two-digit multiplier", () => {
    times(DRAWS, () => {
      const value = drawColumnProduct({ digitsA: 2, digitsB: 2 });
      expect(digitCount(value.b)).toBe(2);
      expect(value.product).toBe(value.a * value.b);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("factors, multiples and the properties", () => {
  it("finds every factor pair", () => {
    expect(factorPairsOf(24)).toEqual([[1, 24], [2, 12], [3, 8], [4, 6]]);
    expect(factorPairsOf(36)).toEqual([[1, 36], [2, 18], [3, 12], [4, 9], [6, 6]]);
    expect(factorPairsOf(1)).toEqual([[1, 1]]);
  });

  it("knows a prime from a composite", () => {
    expect([2, 3, 5, 7, 11, 13, 97].every(isPrime)).toBe(true);
    expect([1, 4, 9, 21, 51, 91, 100].some(isPrime)).toBe(false);
  });

  it("refuses factor pairs of a number that has none", () => {
    expect(() => factorPairsOf(0)).toThrow(/positive number/);
  });

  it("draws only the kind of number the lesson asked for", () => {
    times(DRAWS, () => {
      expect(isPrime(drawFactorNumber({ range: [2, 100], kind: "prime" }))).toBe(true);
      const composite = drawFactorNumber({ range: [12, 100], kind: "composite", minPairs: 3 });
      expect(isPrime(composite)).toBe(false);
      expect(factorPairsOf(composite).length).toBeGreaterThanOrEqual(3);
    });
  });

  it("keeps three factors small enough to bracket either way", () => {
    times(DRAWS, () => {
      const triple = drawTriple({ range: [2, 6], productMax: 120 });
      expect(triple.product).toBe(triple.a * triple.b * triple.c);
      expect(triple.product).toBeLessThanOrEqual(120);
      // Either bracketing reaches the same total, which is the lesson.
      expect((triple.a * triple.b) * triple.c).toBe(triple.a * (triple.b * triple.c));
    });
  });

  it("halves one factor and doubles the other without changing the product", () => {
    times(DRAWS, () => {
      const value = drawHalveDouble({ aRange: [4, 30] });
      expect(value.a % 2).toBe(0);
      expect(value.halved * value.doubled).toBe(value.product);
      expect(value.a * value.b).toBe(value.product);
      // The rewrite has to actually be easier.
      expect(value.doubled % 10).toBe(0);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("estimation", () => {
  it("rounds to the nearest unit, halves upward", () => {
    expect(roundTo(47, 10)).toBe(50);
    expect(roundTo(44, 10)).toBe(40);
    expect(roundTo(450, 100)).toBe(500);
  });

  it("never asks a child to estimate a factor that is already round", () => {
    times(DRAWS, () => {
      const value = drawEstimateProduct({ digitsA: 2, digitsB: 1 });
      expect(value.a % 10).not.toBe(0);
      expect(value.a % 10).not.toBe(5);
    });
  });

  it("keeps both factors worth rounding when both are two digits", () => {
    times(DRAWS, () => {
      const value = drawEstimateProduct({ digitsA: 2, digitsB: 2 });
      expect(value.a % 10).not.toBe(0);
      expect(value.b % 10).not.toBe(0);
      expect(value.b % 10).not.toBe(5);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("stories", () => {
  const kinds: StoryKind[] = [
    "equal_groups_total", "groups_unknown", "size_unknown",
    "times_as_many", "rate", "multi_step",
  ];

  for (const kind of kinds) {
    it(`states an answer that follows from its own numbers: ${kind}`, () => {
      times(DRAWS, () => {
        const story = drawMultiplicationStory(kind);
        expect(story.kind).toBe(kind);
        expect(story.answer).toBeGreaterThanOrEqual(0);

        // Recomputed here from the stated values, never read back from the story.
        switch (kind) {
          case "equal_groups_total":
          case "rate":
            expect(story.answer).toBe(story.values[0] * story.values[1]);
            break;
          case "groups_unknown":
          case "size_unknown":
            expect(story.values[0]).toBe(story.answer * story.values[1]);
            break;
          case "times_as_many":
            expect(story.answer).toBe(story.values[0] * story.values[1]);
            expect(story.additiveAnswer).toBe(story.values[0] + story.values[1]);
            break;
          case "multi_step": {
            const [groups, size, delta] = story.values;
            expect(story.intermediate).toBe(groups * size);
            expect([groups * size + delta, groups * size - delta]).toContain(story.answer);
            break;
          }
        }
      });
    });
  }

  it("divides exactly for both unknown-factor shapes", () => {
    times(DRAWS, () => {
      for (const kind of ["groups_unknown", "size_unknown"] as const) {
        const story = drawMultiplicationStory(kind);
        expect(story.values[0] % story.values[1]).toBe(0);
        expect(Number.isInteger(story.answer)).toBe(true);
        expect(story.answer).toBeGreaterThan(0);
      }
    });
  });

  it("never lets a two-step story pass through a negative stage", () => {
    times(DRAWS, () => {
      const story = drawMultiplicationStory("multi_step");
      expect(story.intermediate).toBeGreaterThanOrEqual(0);
      expect(story.answer).toBeGreaterThanOrEqual(0);
      for (const step of story.steps ?? []) expect(step.result).toBeGreaterThanOrEqual(0);
    });
  });

  it("always supplies the additive misreading a comparison round must offer", () => {
    times(DRAWS, () => {
      const story = drawMultiplicationStory("times_as_many", {
        smallerRange: [2, 12], multiplierRange: [2, 6],
      });
      expect(story.additiveAnswer).toBeDefined();
      expect(story.additiveAnswer).not.toBe(story.answer);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("distractors", () => {
  it("never offers the product, nor a value one away from it", () => {
    times(DRAWS, () => {
      const value = drawProduct({ aRange: [2, 12], bRange: [2, 12] });
      for (const wrong of productDistractors(value, 3)) {
        expect(wrong).not.toBe(value.product);
        expect(Math.abs(wrong - value.product)).not.toBe(1);
        expect(wrong).toBeGreaterThan(0);
        expect(Number.isInteger(wrong)).toBe(true);
      }
    });
  });

  it("returns the number of choices asked for, without repeats", () => {
    times(DRAWS, () => {
      const value = drawProduct({ aRange: [3, 12], bRange: [3, 12] });
      const wrong = productDistractors(value, 3);
      expect(wrong).toHaveLength(3);
      expect(new Set(wrong).size).toBe(3);
    });
  });

  it("can be handed the helper fact's product, which is the mistake to catch", () => {
    const value = { a: 6, b: 8, product: 48 };
    times(20, () => {
      expect(productDistractors(value, 8, 40)).toContain(40);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("no repeats inside a round", () => {
  it("does not ask the same question twice while others remain", () => {
    const seen = new Set<string>();
    const asked: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const value = withoutRepeat(
        () => drawProduct({ aRange: [2, 12], bRange: [2, 12] }),
        productKey,
        seen,
      );
      asked.push(productKey(value));
    }
    expect(new Set(asked).size).toBe(asked.length);
  });

  it("repeats rather than hanging once the question space is exhausted", () => {
    const seen = new Set<string>();
    const only = { a: 3, b: 3, product: 9 };
    withoutRepeat(() => only, productKey, seen);
    expect(withoutRepeat(() => only, productKey, seen)).toEqual(only);
  });
});

/* -------------------------------------------------------------------------- */
/* The derived-fact ladder                                                     */
/* -------------------------------------------------------------------------- */

describe("helperFacts — the ladder holds together", () => {
  it("reconstructs every target from its own helpers", () => {
    for (const fact of HELPER_FACTS) {
      expect(derivedProduct(fact)).toBe(productOf(fact.target));
    }
  });

  it("never asks a child to derive a fact from one they have not met", () => {
    for (const fact of HELPER_FACTS) {
      expect(helpersArriveFirst(fact)).toBe(true);
    }
  });

  it("covers every derivable table across the whole partner range", () => {
    for (const driver of [3, 4, 5, 6, 7, 8, 9, 11, 12]) {
      const covered = HELPER_FACTS
        // Near squares are keyed by their smaller side, so `[3, 4]` would show
        // up as a third entry in the threes. They are checked on their own.
        .filter((fact) => fact.strategy !== "near_square" && fact.target[0] === driver)
        .map((fact) => fact.target[1])
        .sort((one, two) => one - two);
      const expected: number[] = [];
      for (let n = PARTNER_MIN; n <= PARTNER_MAX; n += 1) expected.push(n);
      expect(covered).toEqual(expected);
    }
  });

  it("leaves the two facts that are recalled rather than derived out of the ladder", () => {
    expect(HELPER_FACTS.filter((fact) => fact.strategy === "doubles")).toHaveLength(0);
    expect(HELPER_FACTS.filter((fact) => fact.strategy === "tens")).toHaveLength(0);
  });

  it("applies each adjustment the way the helper card says it does", () => {
    expect(applyAdjust([12], { kind: "double" })).toBe(24);
    expect(applyAdjust([60], { kind: "halve" })).toBe(30);
    expect(applyAdjust([16], { kind: "add_group", of: 8 })).toBe(24);
    expect(applyAdjust([80], { kind: "subtract_group", of: 8 })).toBe(72);
    expect(applyAdjust([40, 16], { kind: "sum" })).toBe(56);
    expect(() => applyAdjust([], { kind: "sum" })).toThrow(/at least one helper/);
  });

  it("derives the facts the master table names, by the route it names", () => {
    const eights = helperFor([8, 7], "triple_double");
    expect(eights?.helpers).toEqual([[2, 7], [4, 7]]);
    expect(derivedProduct(eights!)).toBe(56);

    const nines = helperFor([9, 6], "subtract_a_group");
    expect(nines?.adjust).toEqual({ kind: "subtract_group", of: 6 });
    expect(derivedProduct(nines!)).toBe(54);

    const sevens = helperFor([7, 8], "break_apart");
    expect(sevens?.helpers).toEqual([[5, 8], [2, 8]]);
    expect(derivedProduct(sevens!)).toBe(56);

    const near = helperFor([6, 7], "near_square");
    expect(near?.helpers).toEqual([[6, 6]]);
    expect(derivedProduct(near!)).toBe(42);
  });

  it("finds a fact by either order, because commutativity comes first", () => {
    expect(strategiesFor([7, 8]).length).toBeGreaterThan(0);
    expect(strategiesFor([8, 7]).length).toBe(strategiesFor([7, 8]).length);
  });

  it("dates every fact from the level that teaches it", () => {
    expect(factLevel([2, 9])).toBe(FACTOR_LEVEL[2]);
    expect(factLevel([4, 2])).toBe(FACTOR_LEVEL[2]);
    expect(factLevel([6, 6])).toBe(22);
    // The fours stop at twelve, so they do not make 13 x 4 a known fact.
    expect(() => factLevel([13, 4])).toThrow(/no level is known/);
  });

  it("offers a child only the routes their level has taught", () => {
    // At level 26 the fours and the twos are known, so eight sevens is reachable
    // by doubling; at level 20 nothing derived is.
    expect(availableAt([8, 7], 20)).toHaveLength(0);
    expect(availableAt([8, 7], 25).some((fact) => fact.strategy === "triple_double")).toBe(true);
    for (const fact of availableAt([7, 9], 32)) {
      expect(fact.level).toBeLessThanOrEqual(32);
      for (const helper of fact.helpers) expect(factLevel(helper)).toBeLessThanOrEqual(32);
    }
  });

  it("gives each strategy the facts it is responsible for", () => {
    const counts: Partial<Record<FactStrategy, number>> = {};
    for (const strategy of [
      "double_double", "triple_double", "subtract_a_group", "fives",
    ] as FactStrategy[]) {
      counts[strategy] = factsForStrategy(strategy).length;
    }
    // One per partner, two through twelve.
    for (const count of Object.values(counts)) expect(count).toBe(11);
    // Threes and sixes share "add a group", so that strategy carries both.
    expect(factsForStrategy("add_a_group")).toHaveLength(22);
    // Sevens, elevens and twelves share "break apart".
    expect(factsForStrategy("break_apart")).toHaveLength(33);
    expect(factsForStrategy("near_square")).toHaveLength(9);
  });
});
