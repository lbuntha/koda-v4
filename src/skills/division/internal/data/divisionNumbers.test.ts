import { describe, expect, it } from "vitest";

import {
  digitsOf,
  drawGroupQuotient,
  drawQuotient,
  exchangesIn,
  hasInteriorZero,
  quotientDistractors,
  quotientKey,
  satisfiesQuotient,
  shortDivisionSteps,
  withoutRepeat,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";

/**
 * The generator, proved before any engine exists.
 *
 * Phase 0 of the build plan, and not optional. Every rule in this module is one
 * that fails silently: a "no remainder" lesson with remainders in it, a
 * "split by place value" lesson where a place does not divide, a
 * "zero in the quotient" lesson whose quotients have no zero. None of those
 * throw, none of them look wrong on screen, and all of them teach the wrong
 * thing. The only place they can be caught is here, in bulk, against the
 * constraints a lesson will actually declare.
 *
 * Draw counts are large on purpose. A rule that holds for ten draws and fails
 * for one in fifty is the exact bug this file exists to find.
 */

const DRAWS = 2_000;

/** Every draw from one spec, so a failure names the spec rather than a number. */
const drawMany = (spec: QuotientSpec, n = DRAWS): Quotient[] =>
  Array.from({ length: n }, () => drawQuotient(spec));

describe("the arithmetic itself", () => {
  it("returns questions that are true, whatever the spec", () => {
    const specs: QuotientSpec[] = [
      {},
      { remainder: "always" },
      { divisorRange: [11, 99], quotientRange: [10, 400], remainder: "any" },
      { divisorRange: [2, 9], quotientRange: [100, 999], remainder: "any", excludeTrivial: false },
    ];

    for (const spec of specs) {
      for (const q of drawMany(spec, 500)) {
        expect(q.quotient * q.divisor + q.remainder, `${JSON.stringify(q)}`).toBe(q.dividend);
        expect(q.remainder).toBeGreaterThanOrEqual(0);
        expect(q.remainder).toBeLessThan(q.divisor);
        expect(Number.isInteger(q.quotient)).toBe(true);
      }
    }
  });

  it("judges a question that does not add up as unsatisfiable, whatever else is right", () => {
    const wrong: Quotient = { dividend: 20, divisor: 3, quotient: 6, remainder: 1, meaning: "share" };
    // 6 x 3 + 1 = 19, not 20.
    expect(satisfiesQuotient(wrong)).toBe(false);
  });

  it("refuses a remainder that is not smaller than the divisor", () => {
    const tooBig: Quotient = { dividend: 20, divisor: 3, quotient: 5, remainder: 5, meaning: "share" };
    expect(satisfiesQuotient(tooBig)).toBe(false);
  });
});

describe("remainder", () => {
  it("never means never", () => {
    for (const q of drawMany({ remainder: "never" })) expect(q.remainder).toBe(0);
  });

  it("always means always, and always fits", () => {
    for (const q of drawMany({ remainder: "always" })) {
      expect(q.remainder).toBeGreaterThan(0);
      expect(q.remainder).toBeLessThan(q.divisor);
    }
  });

  it("any produces both, rather than quietly producing one", () => {
    const drawn = drawMany({ remainder: "any" }, 500);
    expect(drawn.some((q) => q.remainder === 0)).toBe(true);
    expect(drawn.some((q) => q.remainder > 0)).toBe(true);
  });

  it("cannot promise a remainder when the divisor is one", () => {
    expect(() =>
      drawQuotient({ divisorRange: [1, 1], remainder: "always", excludeTrivial: false }),
    ).toThrow(/no question satisfies/);
  });
});

describe("exchange — whether a place hands something on", () => {
  it("never means every digit of the dividend divides on its own", () => {
    const spec: QuotientSpec = {
      divisorRange: [2, 9],
      quotientRange: [10, 300],
      dividendRange: [20, 999],
      remainder: "never",
      exchange: "never",
    };
    for (const q of drawMany(spec)) {
      expect(exchangesIn(q.dividend, q.divisor), `${q.dividend} / ${q.divisor}`).toBe(0);
      // The claim behind the constraint: this is honestly a sum of place divisions.
      for (const step of shortDivisionSteps(q.dividend, q.divisor)) {
        expect(step.digit % q.divisor).toBe(0);
      }
    }
  });

  it("always means at least one place carries", () => {
    const spec: QuotientSpec = {
      divisorRange: [2, 9],
      quotientRange: [10, 300],
      dividendRange: [20, 999],
      remainder: "never",
      exchange: "always",
    };
    for (const q of drawMany(spec)) {
      expect(exchangesIn(q.dividend, q.divisor)).toBeGreaterThan(0);
    }
  });

  it("does not count the final remainder as an exchange", () => {
    // 7 / 5 = 1 r 2. One place, nothing handed on, a remainder at the end.
    expect(exchangesIn(7, 5)).toBe(0);
    // 17 / 5 = 3 r 2. The lone ten cannot be divided, so it is exchanged for
    // ten ones. That is an exchange, and it is why this is not a level 29 sum.
    expect(exchangesIn(17, 5)).toBe(1);
    // 84 / 6 = 14. The tens place hands 2 tens to the ones. One exchange.
    expect(exchangesIn(84, 6)).toBe(1);
    // 96 / 3 = 32. Both places divide alone. None.
    expect(exchangesIn(96, 3)).toBe(0);
  });
});

describe("a zero inside the quotient", () => {
  it("knows which zeros are inside", () => {
    expect(hasInteriorZero(103)).toBe(true);
    expect(hasInteriorZero(4052)).toBe(true);
    expect(hasInteriorZero(120)).toBe(false); // trailing
    expect(hasInteriorZero(10)).toBe(false); // trailing
    expect(hasInteriorZero(12)).toBe(false);
  });

  it("is constructed rather than waited for", () => {
    const spec: QuotientSpec = {
      divisorRange: [2, 9],
      quotientRange: [100, 999],
      remainder: "never",
      zeroInQuotient: "always",
    };
    for (const q of drawMany(spec, 500)) {
      expect(hasInteriorZero(q.quotient), `quotient ${q.quotient}`).toBe(true);
      const digits = digitsOf(q.quotient);
      expect(digits[0]).not.toBe(0);
    }
  });

  it("says so when no quotient in range could have one", () => {
    // The default 2-12 range holds no number with a zero inside it.
    expect(() => drawQuotient({ zeroInQuotient: "always" })).toThrow(/zero inside it/);
  });

  it("never means never", () => {
    const spec: QuotientSpec = {
      divisorRange: [2, 9],
      quotientRange: [100, 999],
      remainder: "never",
      zeroInQuotient: "never",
    };
    for (const q of drawMany(spec, 500)) expect(hasInteriorZero(q.quotient)).toBe(false);
  });
});

describe("the two meanings", () => {
  it("honours a meaning a lesson fixes", () => {
    for (const q of drawMany({ meaning: "share" }, 300)) expect(q.meaning).toBe("share");
    for (const q of drawMany({ meaning: "group" }, 300)) expect(q.meaning).toBe("group");
  });

  it("produces both when a lesson mixes them", () => {
    const drawn = drawMany({}, 300);
    expect(drawn.some((q) => q.meaning === "share")).toBe(true);
    expect(drawn.some((q) => q.meaning === "group")).toBe(true);
  });

  it("gives the number line grouping questions and nothing else", () => {
    for (const q of Array.from({ length: 500 }, () => drawGroupQuotient({ remainder: "never" }))) {
      expect(q.meaning).toBe("group");
    }
  });

  it("counts the same numbers asked both ways as two questions", () => {
    const share: Quotient = { dividend: 12, divisor: 3, quotient: 4, remainder: 0, meaning: "share" };
    const group: Quotient = { ...share, meaning: "group" };
    expect(quotientKey(share)).not.toBe(quotientKey(group));
  });
});

describe("ranges and trivial questions", () => {
  it("stays inside every range it is given", () => {
    const spec: QuotientSpec = {
      divisorRange: [3, 7],
      quotientRange: [4, 9],
      dividendRange: [12, 60],
      remainder: "any",
    };
    for (const q of drawMany(spec)) {
      expect(q.divisor).toBeGreaterThanOrEqual(3);
      expect(q.divisor).toBeLessThanOrEqual(7);
      expect(q.quotient).toBeGreaterThanOrEqual(4);
      expect(q.quotient).toBeLessThanOrEqual(9);
      expect(q.dividend).toBeGreaterThanOrEqual(12);
      expect(q.dividend).toBeLessThanOrEqual(60);
    }
  });

  it("drops divide-by-one and divide-by-itself unless a lesson asks for them", () => {
    for (const q of drawMany({ divisorRange: [1, 9], quotientRange: [1, 12] })) {
      expect(q.divisor).not.toBe(1);
      expect(q.quotient).not.toBe(1);
    }
  });

  it("allows them for the lesson that teaches them", () => {
    const drawn = drawMany(
      { divisorRange: [1, 9], quotientRange: [1, 12], excludeTrivial: false },
      500,
    );
    expect(drawn.some((q) => q.divisor === 1 || q.quotient === 1)).toBe(true);
  });

  it("throws on a spec nothing can satisfy, rather than looping", () => {
    expect(() =>
      drawQuotient({ divisorRange: [2, 3], quotientRange: [2, 3], dividendRange: [100, 200] }),
    ).toThrow(/no question satisfies/);
  });
});

describe("short division, walked", () => {
  it("rebuilds the quotient and the remainder from its own steps", () => {
    for (const q of drawMany({ divisorRange: [2, 9], quotientRange: [10, 999], remainder: "any" }, 500)) {
      const steps = shortDivisionSteps(q.dividend, q.divisor);
      const written = Number(steps.map((s) => s.quotientDigit).join(""));
      expect(written).toBe(q.quotient);
      expect(steps[steps.length - 1].carry).toBe(q.remainder);
    }
  });

  it("shows the carry that a written method writes down", () => {
    // 84 / 6: 8 / 6 is 1 carry 2; then 24 / 6 is 4.
    expect(shortDivisionSteps(84, 6)).toEqual([
      { digit: 8, working: 8, quotientDigit: 1, carry: 2 },
      { digit: 4, working: 24, quotientDigit: 4, carry: 0 },
    ]);
  });
});

describe("wrong answers worth offering", () => {
  it("gives distinct, positive, named wrong answers", () => {
    for (const q of drawMany({ remainder: "any", quotientRange: [2, 99] }, 500)) {
      const wrong = quotientDistractors(q);
      expect(wrong).toHaveLength(3);
      const values = wrong.map((d) => d.value);
      expect(new Set(values).size).toBe(3);
      for (const d of wrong) {
        expect(d.value).toBeGreaterThan(0);
        expect(d.value).not.toBe(q.quotient);
        expect(d.kind).toBeTruthy();
      }
    }
  });

  it("does not offer a rounded-up answer when there is nothing to round", () => {
    for (const q of drawMany({ remainder: "never", quotientRange: [2, 99] }, 500)) {
      const wrong = quotientDistractors(q);
      expect(wrong.some((d) => d.kind === "rounded-the-remainder")).toBe(false);
    }
  });

  it("only offers the dropped-zero mistake when there is a zero to drop", () => {
    for (const q of drawMany({ remainder: "never", quotientRange: [11, 99] }, 300)) {
      expect(quotientDistractors(q).some((d) => d.kind === "dropped-quotient-zero")).toBe(false);
    }
  });
});

describe("no repeats inside a round", () => {
  it("does not ask the same question twice while others remain", () => {
    const seen = new Set<string>();
    const spec: QuotientSpec = { divisorRange: [2, 9], quotientRange: [2, 12] };
    const round = Array.from({ length: 10 }, () =>
      withoutRepeat(() => drawQuotient(spec), quotientKey, seen),
    );
    expect(new Set(round.map(quotientKey)).size).toBe(10);
  });

  it("repeats rather than hangs once the space is exhausted", () => {
    const seen = new Set<string>();
    // Exactly two legal questions, asked five times.
    const spec: QuotientSpec = { divisorRange: [3, 3], quotientRange: [4, 4], meaning: "share" };
    const round = Array.from({ length: 5 }, () =>
      withoutRepeat(() => drawQuotient(spec), quotientKey, seen),
    );
    expect(round).toHaveLength(5);
  });
});
