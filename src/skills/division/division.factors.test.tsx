import { describe, expect, it } from "vitest";

import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildFactorQuestion,
  digitSum,
  evidenceFor,
  factorPairs,
  factorsOf,
  isPrime,
  primeFactors,
  splitOptions,
  type FactorMode,
  type FactorQuestion,
} from "./internal/data/divisionFactors";

const lab = skill.activities.factors;

const questions = (mode: FactorMode, n = 200): FactorQuestion[] =>
  Array.from({ length: n }, (_, i) => buildFactorQuestion({ mode }, mode, i));

describe("the arithmetic underneath", () => {
  it("finds every factor pair and stops at the square root", () => {
    expect(factorPairs(36)).toEqual([[1, 36], [2, 18], [3, 12], [4, 9], [6, 6]]);
    expect(factorsOf(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
  });

  it("knows a prime from a composite", () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(91)).toBe(false); // 7 x 13 — the one people call prime
  });

  it("takes a number down to its primes, smallest first", () => {
    expect(primeFactors(60)).toEqual([2, 2, 3, 5]);
    expect(primeFactors(97)).toEqual([97]);
    expect(primeFactors(128)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it("adds digits the way the test does", () => {
    expect(digitSum(981)).toBe(18);
    expect(digitSum(1000)).toBe(1);
  });
});

describe("a test is shown with the evidence it is based on", () => {
  it("shows the last digit for 2, 5 and 10", () => {
    for (const q of questions("last_digit", 80)) {
      expect([2, 5, 10]).toContain(q.tester);
      expect(q.evidence).toContain("last digit");
    }
  });

  it("shows the digit sum for 3 and 9 — and never the last digit", () => {
    for (const q of questions("digit_sum", 80)) {
      expect([3, 9]).toContain(q.tester);
      expect(q.evidence).toContain("add up to");
      expect(q.evidence).not.toContain("last digit");
      expect(q.evidence).toContain(String(digitSum(q.value)));
    }
  });

  it("shows the last two digits for 4, and both tests for 6", () => {
    for (const q of questions("combined_test", 80)) {
      expect([4, 6]).toContain(q.tester);
      if (q.tester === 4) expect(q.evidence).toContain("last two digits");
      else expect(q.evidence).toContain("even");
    }
  });

  it("keeps the evidence honest for every tester", () => {
    expect(evidenceFor(246, 3)).toBe("The digits add up to 12.");
    expect(evidenceFor(246, 2)).toBe("The last digit is 6.");
    expect(evidenceFor(716, 4)).toBe("The last two digits are 16.");
  });
});

describe("the answers cannot be guessed from the look of the number", () => {
  it("splits a round between yes and no", () => {
    for (const mode of ["last_digit", "digit_sum", "combined_test"] as FactorMode[]) {
      const drawn = questions(mode, 20);
      expect(drawn.some((q) => q.divides), mode).toBe(true);
      expect(drawn.some((q) => !q.divides), mode).toBe(true);
    }
  });

  it("makes every 'no' a near miss, so the rule has to be used", () => {
    for (const q of questions("digit_sum", 120)) {
      if (q.divides) continue;
      const tester = q.tester as number;
      const gap = q.value % tester;
      // Within two of a multiple, either side: not obviously wrong at a glance.
      expect(Math.min(gap, tester - gap)).toBeLessThanOrEqual(2);
    }
  });
});

describe("factor_pairs — every one of them", () => {
  it("wants the whole set, and names where the search can stop", () => {
    for (const q of questions("factor_pairs", 80)) {
      expect(q.wanted).toEqual(factorsOf(q.value));
      expect(q.stopAt).toBe(Math.floor(Math.sqrt(q.value)));
      expect(q.wanted).toContain(1);
      expect(q.wanted).toContain(q.value);
    }
  });

  it("says how many are left rather than which", async () => {
    const h = renderActivity(lab, { params: { question: { mode: "factor_pairs" } } });
    const one = h.buttons().find((b) => b === "1");
    if (one) await h.press(one);
    await h.press("That is all of them");
    expect(h.text()).toMatch(/still to find|does not go/);
    h.unmount();
  });
});

describe("common_factors — shared, not just present", () => {
  it("only draws pairs with something worth finding", () => {
    for (const q of questions("common_factors", 80)) {
      expect(q.other).toBeDefined();
      expect(q.wanted.length).toBeGreaterThanOrEqual(2);
      for (const f of q.wanted) {
        expect(q.value % f).toBe(0);
        expect((q.other as number) % f).toBe(0);
      }
    }
  });

  it("puts the highest common factor last in the set", () => {
    for (const q of questions("common_factors", 40)) {
      const highest = Math.max(...q.wanted);
      expect(q.wanted.at(-1)).toBe(highest);
    }
  });
});

describe("prime_factors — a tree the child builds", () => {
  it("never draws a prime, because a prime cannot be split", () => {
    for (const q of questions("prime_factors", 80)) {
      expect(isPrime(q.value)).toBe(false);
      expect((q.primes ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers only genuine splits, and none that use one", () => {
    for (const q of questions("prime_factors", 40)) {
      for (const [a, b] of splitOptions(q.value)) {
        expect(a).toBeGreaterThan(1);
        expect(a * b).toBe(q.value);
      }
    }
  });

  it("leaves a prime with nothing to split it into", () => {
    expect(splitOptions(17)).toEqual([]);
    expect(splitOptions(12)).toEqual([[2, 6], [3, 4]]);
  });

  it("starts with the whole number on the board", () => {
    const h = renderActivity(lab, { params: { question: { mode: "prime_factors" } } });
    expect(h.screen.getByTestId("tree").textContent?.trim()).toMatch(/^\d+$/);
    expect(h.buttons()).not.toContain("All primes");
    h.unmount();
  });
});
