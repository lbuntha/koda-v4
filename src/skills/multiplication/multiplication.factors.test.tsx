import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type FactorMode } from "./activities/FactorBoard";
import {
  drawHalveDouble,
  drawTriple,
  factorPairsOf,
  isPrime,
} from "./internal/data/multiplicationNumbers";

/**
 * FactorBoard, driven the way a child drives it.
 *
 * Everything pressed here is worked out from the prompt's own numbers. For the
 * two board modes especially, the answer is a *set* rather than a value, and a
 * driver that read the key would prove nothing about whether the board can be
 * used to find it.
 */

const factors = skill.activities.factors;

const ALL_MODES: FactorMode[] = ["associative", "halve_double", "factor_pairs", "prime_composite"];

const render = (mode: FactorMode, params: Record<string, unknown> = {}) =>
  renderActivity(factors, { params: { mode, questionsPerRound: 5, ...params } });

afterEach(() => vi.restoreAllMocks());

const drivers: Record<FactorMode, (h: ActivityHarness) => Promise<void>> = {
  associative: async (h) => {
    const [, a, b, c] = /(\d+) × (\d+) × (\d+)\. Choose/.exec(h.text())!;
    await h.press(`Multiply ${a} × ${b} first`);
    await h.press(`${Number(a) * Number(b) * Number(c)}`);
  },
  halve_double: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. Halve one/.exec(h.text())!;
    // Which one can be halved is the decision the strategy turns on.
    const evenFirst = Number(a) % 2 === 0;
    await h.press(evenFirst ? `Halve ${a} and double ${b}` : `Halve ${b} and double ${a}`);
    await h.press(`${Number(a) * Number(b)}`);
  },
  factor_pairs: async (h) => {
    const [, raw] = /Find every pair that makes (\d+)\./.exec(h.text())!;
    const value = Number(raw);
    // One tap per pair, from its smaller end — computed here, not read back.
    for (let n = 1; n * n <= value; n += 1) {
      if (value % n === 0) await h.press(new RegExp(`^${n}(,|$)`));
    }
    await h.press("Check");
  },
  prime_composite: async (h) => {
    const [, value] = /Is (\d+) prime or composite\?/.exec(h.text())!;
    const n = Number(value);
    // Try the board, the way the lesson asks — and work the answer out from it.
    for (let candidate = 2; candidate <= 10; candidate += 1) {
      await h.press(new RegExp(`^Try ${candidate}(,|$)`));
    }
    // Nothing below 2 is offered: one divides everything and settles nothing.
    const composite = [2, 3, 4, 5, 6, 7, 8, 9, 10].some((d) => d < n && n % d === 0);
    await h.press(composite ? `${n} is composite` : `${n} is prime`);
  },
};

describe("every factor mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(factors, drivers[mode], {
        params: { mode, ...(mode === "prime_composite" ? { range: [2, 60] } : {}) },
        questions: 5,
      });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Grouping three factors                                                      */
/* -------------------------------------------------------------------------- */

describe("grouping three factors is a free choice", () => {
  it("accepts either pairing, because neither is wrong", async () => {
    for (const which of ["ab", "bc"] as const) {
      const h = render("associative", { tileRange: [2, 4] });
      const [, a, b, c] = /(\d+) × (\d+) × (\d+)\. Choose/.exec(h.text())!;
      await h.press(which === "ab" ? `Multiply ${a} × ${b} first` : `Multiply ${b} × ${c} first`);
      expect(h.koda.count("learning.answered"), "choosing a grouping was scored").toBe(0);
      await h.press(`${Number(a) * Number(b) * Number(c)}`);
      const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
      expect(report.correct, `grouping ${which} was marked wrong`).toBe(true);
      h.unmount();
    }
  });

  it("shows the first step once a pairing is chosen", async () => {
    const h = render("associative", { tileRange: [2, 4] });
    const [, a, b, c] = /(\d+) × (\d+) × (\d+)\. Choose/.exec(h.text())!;
    await h.press(`Multiply ${a} × ${b} first`);
    expect(h.text()).toContain(`${Number(a) * Number(b)} × ${c}`);
    h.unmount();
  });

  it("refuses an answer before a pairing is chosen, and scores nothing", async () => {
    const h = render("associative", { tileRange: [2, 4] });
    const [, a, b, c] = /(\d+) × (\d+) × (\d+)\. Choose/.exec(h.text())!;
    await h.press(`${Number(a) * Number(b) * Number(c)}`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/choose which two to multiply first/i);
    h.unmount();
  });

  it("never draws three factors whose product breaks the ceiling", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "associative", tileRange: [2, 6], productMax: 120 }, i);
      expect(question.product).toBe(question.a * question.b * question.c);
      expect(question.product).toBeLessThanOrEqual(120);
    }
  });

  it("throws rather than hand back a triple that breaks its own ceiling", () => {
    // This used to return `lo × lo × lo` unchecked, so a range of sixes with a
    // ceiling of 120 quietly produced 216 and called it a question.
    expect(() => drawTriple({ range: [6, 6], productMax: 120 })).toThrow(/no triple/);
  });
});

/* -------------------------------------------------------------------------- */
/* Halve and double                                                            */
/* -------------------------------------------------------------------------- */

describe("halving one factor and doubling the other", () => {
  /*
   * The partner is drawn from 5, 15, 25 and 50, and one of those is even.
   *
   * So "the odd factor" is not always odd, and the first version of this test
   * flaked about one run in three — it pressed the 50 and got the *other*
   * refusal. Pinning the draw picks the case on purpose rather than hoping for
   * it: with the halved factor fixed, the only random choice left is the
   * partner, and a seed below 0.25 takes the 5 while 0.9 takes the 50.
   */
  const withPartner = (seed: number) => {
    vi.spyOn(Math, "random").mockReturnValue(seed);
    const h = render("halve_double", { aRange: [16, 16] });
    const [, a, b] = /(\d+) × (\d+)\. Halve one/.exec(h.text())!;
    return { h, a: Number(a), b: Number(b) };
  };

  it("refuses to halve an odd factor, and scores nothing", async () => {
    const { h, a, b } = withPartner(0.1);
    expect(b % 2, "the seed was meant to draw an odd partner").toBe(1);
    await h.press(`Halve ${b} and double ${a}`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/cannot be halved into whole groups/i);
    h.unmount();
  });

  it("rewrites to a pair that holds the same total", async () => {
    const h = render("halve_double");
    const [, a, b] = /(\d+) × (\d+)\. Halve one/.exec(h.text())!;
    const even = Number(a) % 2 === 0 ? a : b;
    const other = even === a ? b : a;
    await h.press(`Halve ${even} and double ${other}`);
    expect(h.text()).toContain(`${Number(even) / 2} × ${Number(other) * 2}`);
    h.unmount();
  });

  it("refuses an answer before the rewrite is made", async () => {
    const h = render("halve_double");
    const [, a, b] = /(\d+) × (\d+)\. Halve one/.exec(h.text())!;
    await h.press(`${Number(a) * Number(b)}`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/make the rewrite first/i);
    h.unmount();
  });

  it("always rewrites to something easier, and never changes the total", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "halve_double" }, i);
      expect(question.halved * question.doubled).toBe(question.a * question.b);
      expect(question.a % 2).toBe(0);
      // The rewrite has to actually help: the doubled partner lands on a ten.
      expect(question.doubled % 10).toBe(0);
      /*
       * And exactly one direction may be taken.
       *
       * `20 × 50` was drawable, and there both rewrites are legal — halving the
       * fifty gives `40 × 25`, which is worse than what it replaced. Barring a
       * factor that is already round leaves one move worth making, which is
       * what a strategy lesson needs.
       */
      expect(question.a % 10).not.toBe(0);
      expect((question.a * 2) % 10).not.toBe(0);
    }
  });

  it("refuses the direction that makes the product harder", async () => {
    // Both factors even: 16 × 50. Halving the fifty gives 32 × 25 — honest
    // arithmetic, and harder than what it replaced.
    const { h, a, b } = withPartner(0.9);
    expect(b % 2, "the seed was meant to draw the even partner").toBe(0);
    await h.press(`Halve ${b} and double ${a}`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/which is no easier/i);
    // The move that does help is still there to make.
    await h.press(`Halve ${a} and double ${b}`);
    expect(h.text()).toContain(`${a / 2} × ${b * 2}`);
    h.unmount();
  });

  it("throws rather than hand back a pair outside the range asked for", () => {
    // The old fallback returned a fixed 16 × 5 whatever the lesson requested.
    expect(() => drawHalveDouble({ aRange: [41, 41] })).toThrow(/no halve-and-double/);
    const drawn = drawHalveDouble({ aRange: [40, 60] });
    expect(drawn.a).toBeGreaterThanOrEqual(40);
    expect(drawn.a).toBeLessThanOrEqual(60);
  });
});

/* -------------------------------------------------------------------------- */
/* The candidate board                                                         */
/* -------------------------------------------------------------------------- */

describe("finding every factor pair", () => {
  /**
   * The board offers one to ten, and that is exactly enough.
   *
   * For any number up to a hundred, a factor of ten or less is always the
   * smaller member of its pair — so "tap every one of these that divides it"
   * and "find every pair" are the same instruction. A board that offered
   * eleven or twelve would break that, because 12 divides 96 but is the
   * *larger* half of 8 × 12 and would count as a second tap for one pair.
   */
  it("puts the smaller half of every pair within reach of the board", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "factor_pairs" }, i);
      expect(question.value).toBeGreaterThanOrEqual(12);
      expect(question.value).toBeLessThanOrEqual(100);
      expect(question.pairs).toEqual(factorPairsOf(question.value));
      for (const [small, large] of question.pairs) {
        expect(small * large).toBe(question.value);
        // The smaller half cannot exceed the square root, so it is always on
        // the board — no pair can be missed for want of a bigger button.
        expect(small).toBeLessThanOrEqual(10);
        expect(small).toBeLessThanOrEqual(large);
      }
      // "Every pair" is only a task if there is more than one.
      expect(question.pairs.length).toBeGreaterThanOrEqual(2);
    }
  });

  /*
   * The reason the board judges pairs rather than taps.
   *
   * Some of the ten candidates are the *larger* half of a pair another
   * candidate already names: 7 divides 28, but 4 × 7 is the pair a tap on 4
   * finds. Counting taps would have marked a child wrong for spotting that 7
   * goes into 28.
   */
  it("accepts either end of a pair", async () => {
    // 28 is 1 × 28, 2 × 14 and 4 × 7. The third pair can be named from either
    // end, and the order the pairs are found in is the child's business.
    for (const taps of [[1, 2, 4], [1, 2, 7], [7, 1, 2]] as number[][]) {
      const h = render("factor_pairs", { range: [28, 28] });
      for (const n of taps) await h.press(new RegExp(`^${n}(,|$)`));
      await h.press("Check");
      const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
      expect(report.correct, `28 from taps ${taps.join(",")}`).toBe(true);
      h.unmount();
    }
  });

  it("rejects a tap that divides nothing, and says which", async () => {
    const h = render("factor_pairs", { range: [28, 28] });
    for (const n of [1, 2, 4, 3]) await h.press(new RegExp(`^${n}(,|$)`));
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(/3 does not divide 28/);
    h.unmount();
  });

  it("checks the whole set once, not one tap at a time", async () => {
    const h = render("factor_pairs", { range: [24, 24] });
    await h.press(/^1(,|$)/);
    await h.press(/^2(,|$)/);
    expect(h.koda.count("learning.answered"), "a tap was scored on its own").toBe(0);
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(1);
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    // 24 has four pairs; two of them is not the set.
    expect(report.correct).toBe(false);
    h.unmount();
  });

  it("accepts the complete set", async () => {
    const h = render("factor_pairs", { range: [24, 24] });
    // 1 × 24, 2 × 12, 3 × 8, 4 × 6 — four pairs, named from their smaller ends.
    for (const n of [1, 2, 3, 4]) await h.press(new RegExp(`^${n}(,|$)`));
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    expect(report.correct).toBe(true);
    h.unmount();
  });

  it("lets a tap be taken back", async () => {
    const h = render("factor_pairs", { range: [24, 24] });
    await h.press(/^5(,|$)/);
    await h.press(/^5(,|$)/);
    for (const n of [1, 2, 3, 4]) await h.press(new RegExp(`^${n}(,|$)`));
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    expect(report.correct, "an untapped candidate still counted").toBe(true);
    h.unmount();
  });

  it("refuses an empty check", async () => {
    const h = render("factor_pairs", { range: [24, 24] });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/tap the numbers that divide it/i);
    h.unmount();
  });
});

describe("prime or composite is decided on the board, not from memory", () => {
  /*
   * One divides everything, so it settles nothing.
   *
   * It belongs on the factor-pairs board, where `1 × 45` is a real pair. On a
   * primality board it lit up in the same colour as a genuine find and pointed
   * a child straight at the wrong answer.
   */
  it("does not offer 1 as something to divide by", async () => {
    const h = render("prime_composite", { range: [47, 47] });
    expect(h.buttons()).not.toContain("Try 1");
    expect(h.buttons().filter((l) => /^Try \d+$/.test(l))).toHaveLength(9);
    h.unmount();

    // But the factor-pairs board still offers it, because a pair needs it.
    const pairs = render("factor_pairs", { range: [45, 45] });
    expect(pairs.buttons()).toContain("1");
    pairs.unmount();
  });

  it("refuses an answer before anything has been tried", async () => {
    const h = render("prime_composite", { range: [17, 17] });
    await h.press("17 is prime");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/try a number on the board first/i);
    h.unmount();
  });

  it("says whether each number tried divides the total, and scores none of it", async () => {
    const h = render("prime_composite", { range: [21, 21] });
    await h.press(/^Try 3(,|$)/);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.buttons()).toContain("Try 3, divides 21");
    await h.press(/^Try 4(,|$)/);
    expect(h.buttons()).toContain("Try 4, does not divide 21");
    h.unmount();
  });

  it("names the pair it found when the number is composite", async () => {
    const h = render("prime_composite", { range: [21, 21] });
    await h.press(/^Try 3(,|$)/);
    await h.press("21 is composite");
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    expect(report.correct).toBe(true);
    expect(h.text()).toMatch(/3 × 7 = 21/);
    h.unmount();
  });

  it("says nothing divides a prime", async () => {
    const h = render("prime_composite", { range: [17, 17] });
    await h.press(/^Try 2(,|$)/);
    await h.press("17 is prime");
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean });
    expect(report.correct).toBe(true);
    expect(h.text()).toMatch(/Nothing divides 17 but 1 and 17/);
    h.unmount();
  });

  it("labels every number it draws against real arithmetic", () => {
    for (let i = 0; i < 300; i += 1) {
      const question = buildQuestion({ mode: "prime_composite" }, i);
      expect(question.prime).toBe(isPrime(question.value));
      expect(question.value).toBeGreaterThanOrEqual(2);
      expect(question.value).toBeLessThanOrEqual(100);
    }
  });

  /*
   * Every prime up to a hundred is decidable from the ten numbers offered.
   *
   * A composite below 101 always has a factor at or below 10, because its
   * smallest factor cannot exceed its square root. So a child who tries all ten
   * and finds nothing has genuinely proved the number prime rather than run out
   * of board — which is the difference between a method and a guess.
   */
  it("gives the board enough numbers to settle any question it asks", () => {
    for (let n = 2; n <= 100; n += 1) {
      const divisor = [2, 3, 4, 5, 6, 7, 8, 9, 10].find((d) => d < n && n % d === 0);
      expect(Boolean(divisor), `${n} cannot be settled from the board`).toBe(!isPrime(n));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints all four modes", () => {
  it("prints a self-contained question and its answer", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = factors.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text.length).toBeGreaterThan(10);
        expect(printed!.answer.length).toBeGreaterThan(0);
        expect(factors.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // Factor work is written arithmetic; there is nothing to draw.
        expect(factors.worksheet!.figure!(question)).toBeNull();
      }
    }
  });
});
