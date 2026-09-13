/**
 * What the array engine asks, and when it will accept an answer.
 *
 * Separate from the component for the same reason the tray's rules are: the
 * three techniques here differ only in what is held fixed — the number of rows,
 * or the width of one — and that is a data question a test should be able to ask
 * without mounting a grid.
 */

import {
  drawQuotient,
  pick,
  quotientDistractors,
  quotientKey,
  withoutRepeat,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";
import { orderBySeed, type Tone } from "./divisionTray";

export type ArrayMode =
  /** Set the array to the given number of rows; read the width of one. */
  | "total_and_side"
  /** Read one array as both of the divisions it shows. */
  | "two_divisions"
  /** Fill rows of a fixed width; the short last row is what is left. */
  | "partial_row";

export interface ArraySetup {
  mode?: ArrayMode;
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

/**
 * Ranges chosen so the grid stays readable rather than so the sums stay easy.
 *
 * Twelve is the ceiling on either side because a 12x12 array is already 144
 * cells and the point of the picture is that a child can see the rows, not that
 * they can be counted if you try hard enough.
 */
const DEFAULTS: Record<ArrayMode, ModeDefaults> = {
  total_and_side: { divisorRange: [2, 10], quotientRange: [2, 10], totalMax: 100 },
  two_divisions: { divisorRange: [2, 9], quotientRange: [2, 9], totalMax: 81 },
  partial_row: { divisorRange: [3, 8], quotientRange: [2, 8], totalMax: 64 },
};

export interface ArrayQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: ArrayMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** The answer the child gives. */
  answer: number;
  /** Rows the child must build before the question will take an answer. */
  targetRows: number;
  /** Fixed row width, for the mode that fixes it. */
  rowWidth?: number;
  /** Equation pairs, for `two_divisions`. */
  pairs?: string[];
  tone: Tone;
}

const TONES: readonly Tone[] = ["sky", "violet", "emerald", "rose"] as const;

const PROMPTS: Record<ArrayMode, (q: Omit<ArrayQuestion, "prompt">) => string> = {
  total_and_side: (q) =>
    `Put all ${q.dividend} into ${q.divisor} equal rows. How many in each row?`,
  two_divisions: () => "Which pair of sentences does this array show?",
  partial_row: (q) =>
    `Make rows of ${q.divisor}. How many full rows can you make?`,
};

/**
 * The two sentences one array shows, and three pairs that it does not.
 *
 * A wrong pair is wrong in one half only. Both halves wrong is a pair a child
 * discards on the first sentence and never reads the second of — which is the
 * half the level is actually about.
 */
export function pairOptions(value: Quotient): string[] {
  const { dividend, divisor, quotient } = value;
  const truth = `${dividend} ÷ ${divisor} = ${quotient}   and   ${dividend} ÷ ${quotient} = ${divisor}`;
  /*
   * The miscounted side must not be the *right* side.
   *
   * The first distractor offered for a quotient is the divisor — "you gave the
   * number of rows, not the length of one" — and that is the true value in the
   * second sentence here. Taken blindly it rebuilds the true pair and the
   * question has two right answers, neither of them marked.
   */
  const near =
    quotientDistractors(value, 3).find((d) => d.value !== divisor) ??
    { value: divisor + 1, kind: "off-by-one-group" as const };
  return [
    truth,
    // The second sentence turned round: the commonest error, and it needs the
    // first sentence read to be caught.
    `${dividend} ÷ ${divisor} = ${quotient}   and   ${quotient} ÷ ${dividend} = ${divisor}`,
    // One side miscounted, in the second sentence only.
    `${dividend} ÷ ${divisor} = ${quotient}   and   ${dividend} ÷ ${quotient} = ${near.value}`,
    // Multiplication wearing division's clothes.
    `${dividend} ÷ ${divisor} = ${quotient}   and   ${divisor} ÷ ${quotient} = ${dividend}`,
  ];
}

export function buildArrayQuestion(
  setup: ArraySetup,
  mode: ArrayMode,
  index: number,
  seen?: Set<string>,
): ArrayQuestion {
  const fallback = DEFAULTS[mode];
  const spec: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [4, setup.totalMax ?? fallback.totalMax],
    remainder: mode === "partial_row" ? "always" : "never",
    distinctSides: mode === "two_divisions",
  };

  const draw = () => drawQuotient(spec);
  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const tone = pick(TONES);
  const id = `division-${mode}-${index}-${value.dividend}-${value.divisor}`;

  const base = {
    id,
    taskKind: `division_${mode}`,
    expected: String(value.quotient),
    itemCount: value.dividend,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    answer: value.quotient,
    /*
     * `partial_row` fixes the width of a row, so the rows the child builds are
     * the answer and cannot be a gate on it. The other two fix the row count,
     * and the array has to be built before it says anything.
     */
    targetRows: mode === "partial_row" ? 0 : value.divisor,
    rowWidth: mode === "partial_row" ? value.divisor : undefined,
    tone,
  };

  const prompt = PROMPTS[mode](base as Omit<ArrayQuestion, "prompt">);

  if (mode === "two_divisions") {
    return {
      ...base,
      prompt,
      expected: pairOptions(value)[0],
      pairs: orderBySeed(pairOptions(value), id),
    };
  }

  return { ...base, prompt };
}

/** Why the array will not take an answer yet. `null` means it will. */
export type ArrayBlock = "wrong-row-count" | "not-all-placed" | "rows-unequal" | null;

/**
 * The array has to be *made* before it is read.
 *
 * A child who answers from the prompt alone has done arithmetic, which is fine
 * at level 21 and not the point at level 9: this engine exists so that "the
 * missing side" is something seen on a grid rather than recalled. So the grid
 * must actually be in the shape the question named.
 */
export function arrayBlockedBecause(
  question: ArrayQuestion,
  rows: number,
  placed: number,
): ArrayBlock {
  if (question.mode === "partial_row") {
    if (placed < question.dividend) return "not-all-placed";
    return null;
  }
  if (rows !== question.targetRows) return "wrong-row-count";
  if (placed < question.dividend) return "not-all-placed";
  if (question.dividend % rows !== 0) return "rows-unequal";
  return null;
}

export const ARRAY_REFUSALS: Record<Exclude<ArrayBlock, null>, string> = {
  "wrong-row-count": "Make the number of rows the question asked for.",
  "not-all-placed": "Every one of them has to go into the array.",
  "rows-unequal": "The rows are not all the same length.",
};

/**
 * How the cells fall into rows.
 *
 * Row-major and left to right, which is how a child fills one and how the short
 * final row of `partial_row` ends up being the remainder without anyone having
 * to say so.
 */
export function rowsOf(total: number, width: number): number[] {
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    out.push(Math.min(width, left));
    left -= width;
  }
  return out;
}
