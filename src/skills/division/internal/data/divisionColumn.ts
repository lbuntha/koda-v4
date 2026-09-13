/**
 * The written method — short division, long division, and the first step past
 * the decimal point.
 *
 * The algorithm is one loop: look at what you have, take out as many whole
 * divisors as fit, write that above the line, and hand what is left to the next
 * place. `shortDivisionSteps` in `divisionNumbers` already walks it, which is
 * why this module is short: the arithmetic was settled in Phase 0 and what is
 * left is deciding which shapes each lesson draws.
 *
 * Long division is the same loop with a two-digit divisor. It is a separate set
 * of levels because the *estimate* stops being free — "how many 7s in 43" is
 * recall, "how many 23s in 147" is a guess a child has to check and sometimes
 * revise — and not because the method changes.
 */

import {
  digitsOf,
  drawQuotient,
  hasInteriorZero,
  quotientKey,
  shortDivisionSteps,
  withoutRepeat,
  type DivisionStep,
  type QuotientSpec,
} from "./divisionNumbers";

export type ColumnMode =
  /** Every digit divides; nothing is carried. */
  | "short_exact"
  /** At least one place hands something on. */
  | "short_exchange"
  /** As above, and something is left at the end. */
  | "short_remainder"
  /** A zero sits inside the answer. */
  | "zero_digit"
  /** Two-digit divisor, nothing left over. */
  | "long_exact"
  /** Two-digit divisor, something left over. */
  | "long_remainder"
  /** Keep going past the point until it comes out. */
  | "decimal_tail";

export interface ColumnSetup {
  mode?: ColumnMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  divisorRange?: [number, number];
  quotientRange?: [number, number];
  totalMax?: number;
}

interface ModeDefaults {
  divisorRange: [number, number];
  quotientRange: [number, number];
  totalMax: number;
}

const DEFAULTS: Record<ColumnMode, ModeDefaults> = {
  short_exact: { divisorRange: [2, 9], quotientRange: [11, 444], totalMax: 999 },
  short_exchange: { divisorRange: [2, 9], quotientRange: [11, 1111], totalMax: 9999 },
  short_remainder: { divisorRange: [2, 9], quotientRange: [11, 1111], totalMax: 9999 },
  zero_digit: { divisorRange: [2, 9], quotientRange: [101, 909], totalMax: 9999 },
  long_exact: { divisorRange: [11, 99], quotientRange: [11, 99], totalMax: 9999 },
  long_remainder: { divisorRange: [11, 99], quotientRange: [11, 99], totalMax: 9999 },
  decimal_tail: { divisorRange: [2, 50], quotientRange: [2, 40], totalMax: 999 },
};

/** The divisors whose reciprocals terminate inside two decimal places. */
const TWO_PLACE_DIVISORS = [2, 4, 5, 20, 25, 50] as const;

export interface ColumnQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: ColumnMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** One step per digit of the dividend, as the method walks them. */
  steps: DivisionStep[];
  /** The digits of the dividend, for the layout. */
  dividendDigits: number[];
  /** The quotient digits, including leading zeros, one per dividend digit. */
  quotientDigits: number[];
  /** True when the child types digits after the point as well. */
  hasDecimal: boolean;
  /** The decimal digits, for the mode that goes past the point. */
  decimalDigits: number[];
  /** True when a remainder has to be written at the end. */
  wantsRemainder: boolean;
}

export function buildColumnQuestion(
  setup: ColumnSetup,
  mode: ColumnMode,
  index: number,
  seen?: Set<string>,
): ColumnQuestion {
  const fallback = DEFAULTS[mode];
  const base: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [20, setup.totalMax ?? fallback.totalMax],
  };

  const spec: QuotientSpec = (() => {
    switch (mode) {
      case "short_exact":
        return { ...base, remainder: "never" as const, exchange: "never" as const };
      case "short_exchange":
        return { ...base, remainder: "never" as const, exchange: "always" as const };
      case "short_remainder":
        return { ...base, remainder: "always" as const, exchange: "always" as const };
      case "zero_digit":
        return { ...base, remainder: "never" as const, zeroInQuotient: "always" as const };
      case "long_exact":
        return { ...base, remainder: "never" as const };
      case "long_remainder":
        return { ...base, remainder: "always" as const };
      default:
        return { ...base, remainder: "always" as const };
    }
  })();

  const draw = () => {
    if (mode === "decimal_tail") {
      /*
       * A division that does not come out, and whose tail stops inside two
       * places.
       *
       * Drawn from the divisors whose reciprocals terminate — halves, quarters,
       * fifths and their tens — because a lesson that bridges to decimals must
       * not also be a lesson about recurring ones. `1 ÷ 3` is a fine question
       * and it belongs to a skill that has somewhere to put 0.333...
       */
      const divisor = TWO_PLACE_DIVISORS[Math.floor(Math.random() * TWO_PLACE_DIVISORS.length)];
      const whole = 2 + Math.floor(Math.random() * 40);
      const remainder = 1 + Math.floor(Math.random() * (divisor - 1));
      return {
        dividend: whole * divisor + remainder,
        divisor,
        quotient: whole,
        remainder,
        meaning: "group" as const,
      };
    }
    return drawQuotient(spec);
  };

  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const steps = shortDivisionSteps(value.dividend, value.divisor);
  const dividendDigits = digitsOf(value.dividend);
  const quotientDigits = steps.map((step) => step.quotientDigit);
  const hasDecimal = mode === "decimal_tail";

  /*
   * The digits after the point, found by carrying on with zeros.
   *
   * Exactly the same loop: the remainder becomes tenths, then hundredths. The
   * method does not change at the point, and the screen should not suggest it
   * does.
   */
  const decimalDigits: number[] = [];
  if (hasDecimal) {
    let carry = value.remainder;
    while (carry > 0 && decimalDigits.length < 2) {
      const working = carry * 10;
      decimalDigits.push(Math.floor(working / value.divisor));
      carry = working % value.divisor;
    }
  }

  const wantsRemainder =
    mode === "short_remainder" || mode === "long_remainder";

  const expected = hasDecimal
    ? `${value.quotient}.${decimalDigits.join("")}`
    : wantsRemainder
      ? `${value.quotient} r ${value.remainder}`
      : String(value.quotient);

  return {
    id: `division-${mode}-${index}-${value.dividend}-${value.divisor}`,
    taskKind: `division_${mode}`,
    prompt: `${value.dividend} ÷ ${value.divisor}`,
    expected,
    itemCount: dividendDigits.length,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    steps,
    dividendDigits,
    quotientDigits,
    hasDecimal,
    decimalDigits,
    wantsRemainder,
  };
}

/** Why a digit typed above the line will not be accepted. */
export type DigitVerdict = "ok" | "too-big" | "too-small";

/**
 * Judge one digit of the quotient, at the place it was written.
 *
 * Checked as it is typed rather than at the end, and this is the one place in
 * the skill where that is right: the written method is a *sequence*, and a child
 * who puts 6 where 7 belongs and carries on has spent four more steps on an
 * answer that stopped being retrievable at the first one. The two verdicts are
 * the two things that can go wrong, and each names itself:
 *
 *   too-big    `d x divisor` overshoots what is there
 *   too-small  what is left is still `divisor` or more, so another one fits
 */
export function judgeDigit(working: number, divisor: number, digit: number): DigitVerdict {
  const left = working - digit * divisor;
  if (left < 0) return "too-big";
  if (left >= divisor) return "too-small";
  return "ok";
}

export const DIGIT_REFUSALS: Record<Exclude<DigitVerdict, "ok">, string> = {
  "too-big": "That is more than there is. Try a smaller digit.",
  "too-small": "Another whole one still fits there. Try a bigger digit.",
};

/** What the child is dividing into at place `i`, given the carries so far. */
export const workingAt = (question: ColumnQuestion, index: number): number =>
  question.steps[index]?.working ?? 0;

/** Confirms the built answer is the one the question wanted. */
export const answerMatches = (
  question: ColumnQuestion,
  digits: readonly number[],
  remainder: string,
  decimals: readonly number[],
): boolean => {
  if (digits.length !== question.quotientDigits.length) return false;
  if (!digits.every((d, i) => d === question.quotientDigits[i])) return false;
  if (question.wantsRemainder && Number(remainder) !== question.remainder) return false;
  if (question.hasDecimal) {
    if (decimals.length !== question.decimalDigits.length) return false;
    if (!decimals.every((d, i) => d === question.decimalDigits[i])) return false;
  }
  return true;
};

/** True when this question's answer has a zero sitting inside it. */
export const hasZeroInside = (question: ColumnQuestion): boolean => hasInteriorZero(question.quotient);
