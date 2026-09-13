/**
 * Dividing a place at a time.
 *
 * `96 ÷ 3` is honestly `(90 ÷ 3) + (6 ÷ 3)`, and a child who sees that has the
 * whole of written division in front of them a year before they meet the
 * algorithm. `84 ÷ 6` is not: the tens place gives 8 ÷ 6, which does not go, so
 * the split has to be *chosen* rather than read off the digits — 60 and 24, not
 * 80 and 4. That single difference is levels 29 and 30, and it is the thing the
 * standard algorithm is silently doing at every step.
 *
 * So the split is computed, not assumed, and the same function serves both: a
 * lesson asks for `exchange: "never"` and gets numbers whose friendly split *is*
 * the place split, or for `exchange: "always"` and gets numbers where it is not.
 */

import {
  drawQuotient,
  placeSplit,
  placeSplitWorks,
  quotientKey,
  withoutRepeat,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";

export type PlaceMode =
  /** `60 ÷ 3` — a multiple of ten, read as tens. */
  | "tens_quotient"
  /** `4500 ÷ 100` — the digits move right. */
  | "scale_down"
  /** `600 ÷ 30` — a zero on each side cancels. */
  | "tens_into_tens"
  /** `96 ÷ 3` — every place divides on its own. */
  | "split_exact"
  /** `84 ÷ 6` — a place does not divide, so the split has to move. */
  | "split_exchange";

export interface PlaceSetup {
  mode?: PlaceMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  divisorRange?: [number, number];
  quotientRange?: [number, number];
  totalMax?: number;
}

/**
 * The split a child should use, largest friendly part first.
 *
 * Each part is a multiple of the divisor *and* a round number where it can be:
 * take the biggest multiple of `divisor x 10^k` that fits, subtract, repeat. For
 * 96 ÷ 3 that gives 90 then 6, which is the place split. For 84 ÷ 6 it gives 60
 * then 24, which is not — and the difference is visible on screen rather than
 * asserted in a hint.
 */
export function friendlySplit(dividend: number, divisor: number): number[] {
  /*
   * When the digits work, use the digits.
   *
   * The search below is correct but not *natural*: for 342 ÷ 2 it offers
   * 200 + 140 + 2, which divides fine and is nobody's idea of splitting a
   * number by place value. A child who has just been told "split it into
   * hundreds, tens and ones" should see hundreds, tens and ones.
   */
  if (placeSplitWorks(dividend, divisor)) return placeSplit(dividend);

  const parts: number[] = [];
  let left = dividend;
  let unit = 10 ** (String(Math.floor(dividend / divisor)).length - 1);
  while (left > 0 && unit >= 1) {
    const step = divisor * unit;
    const times = Math.floor(left / step);
    if (times > 0) {
      parts.push(step * times);
      left -= step * times;
    }
    unit /= 10;
  }
  if (left > 0) parts.push(left);
  return parts;
}

/*
 * `placeSplit` and `placeSplitWorks` live in `divisionNumbers` beside the other
 * place-value primitives, because the generator has to judge on them. Re-exported
 * here so this module stays the one place the place-value engine reads from.
 */
export { placeSplit, placeSplitWorks } from "./divisionNumbers";

export interface PlaceQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: PlaceMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** The parts the child divides one at a time. One part means "just divide it". */
  parts: number[];
  /** What each part gives. */
  partQuotients: number[];
  /** True when the naive place split would have worked. */
  placeSplitWorks: boolean;
}

interface ModeDefaults {
  divisorRange: [number, number];
  quotientRange: [number, number];
  totalMax: number;
}

const DEFAULTS: Record<PlaceMode, ModeDefaults> = {
  tens_quotient: { divisorRange: [2, 9], quotientRange: [2, 40], totalMax: 360 },
  scale_down: { divisorRange: [10, 100], quotientRange: [2, 99], totalMax: 9900 },
  tens_into_tens: { divisorRange: [20, 90], quotientRange: [2, 30], totalMax: 2700 },
  split_exact: { divisorRange: [2, 9], quotientRange: [11, 331], totalMax: 999 },
  split_exchange: { divisorRange: [3, 9], quotientRange: [11, 111], totalMax: 999 },
};

const PROMPTS: Record<PlaceMode, (q: Omit<PlaceQuestion, "prompt">) => string> = {
  tens_quotient: (q) => `${q.dividend} ÷ ${q.divisor}. How many tens is that, and how many altogether?`,
  scale_down: (q) => `${q.dividend} ÷ ${q.divisor}`,
  tens_into_tens: (q) => `${q.dividend} ÷ ${q.divisor}`,
  split_exact: (q) => `${q.dividend} ÷ ${q.divisor}, one place at a time.`,
  split_exchange: (q) => `${q.dividend} ÷ ${q.divisor}. The tens will not divide on their own.`,
};

export function buildPlaceQuestion(
  setup: PlaceSetup,
  mode: PlaceMode,
  index: number,
  seen?: Set<string>,
): PlaceQuestion {
  const fallback = DEFAULTS[mode];
  const base: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [10, setup.totalMax ?? fallback.totalMax],
    remainder: "never",
  };

  /*
   * `placeSplit`, not `exchange`.
   *
   * These two lessons are about splitting a number by the value of its digits,
   * which is a different question from whether short division carries. 420 ÷ 4
   * carries (2 tens will not divide by 4) and splits perfectly (400 and 20 both
   * do). Constraining on `exchange` put it in the wrong lesson.
   */
  const spec: QuotientSpec =
    mode === "split_exact"
      ? { ...base, placeSplit: "always" }
      : mode === "split_exchange"
        ? { ...base, placeSplit: "never" }
        : base;

  const draw = (): Quotient => {
    if (mode === "tens_quotient") {
      // A multiple of ten divided by a single digit, exactly.
      const divisor = 2 + Math.floor(Math.random() * 8);
      const tens = 2 + Math.floor(Math.random() * 8);
      return {
        dividend: divisor * tens * 10,
        divisor,
        quotient: tens * 10,
        remainder: 0,
        meaning: "share",
      };
    }
    if (mode === "scale_down") {
      const divisor = Math.random() < 0.5 ? 10 : 100;
      const quotient = 2 + Math.floor(Math.random() * 98);
      return { dividend: quotient * divisor, divisor, quotient, remainder: 0, meaning: "group" };
    }
    if (mode === "tens_into_tens") {
      const a = 2 + Math.floor(Math.random() * 8);
      const b = 2 + Math.floor(Math.random() * 8);
      const quotient = 2 + Math.floor(Math.random() * 9);
      const divisor = b * 10;
      return { dividend: divisor * quotient, divisor, quotient, remainder: 0, meaning: "group" };
    }
    return drawQuotient(spec);
  };

  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const splitting = mode === "split_exact" || mode === "split_exchange";
  const parts = splitting ? friendlySplit(value.dividend, value.divisor) : [value.dividend];
  const id = `division-${mode}-${index}-${value.dividend}-${value.divisor}`;

  const shaped = {
    id,
    taskKind: `division_${mode}`,
    expected: String(value.quotient),
    itemCount: parts.length,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    parts,
    partQuotients: parts.map((part) => part / value.divisor),
    placeSplitWorks: placeSplitWorks(value.dividend, value.divisor),
  };

  return { ...shaped, prompt: PROMPTS[mode](shaped as Omit<PlaceQuestion, "prompt">) };
}
