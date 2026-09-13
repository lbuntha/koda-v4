/**
 * What the number line asks.
 *
 * Every question here is drawn through `drawGroupQuotient`, which is narrowed to
 * `meaning: "group"` at the type level. That is not tidiness: hopping back from
 * a total in steps of the divisor shows *how many lots of this size fit*, and
 * there is no honest number-line picture of dealing a total out between a number
 * of people. An engine that drew a sharing question anyway would be teaching a
 * child that the divisor is always the size of a step.
 */

import { drawGroupQuotient, pick, quotientKey, withoutRepeat, type GroupQuotient, type QuotientSpec } from "./divisionNumbers";
import type { Tone } from "./divisionTray";

export type LineMode =
  /** Take the divisor away again and again until nothing is left. */
  | "back_to_zero"
  /** The hops are already drawn. Say how many there are, not where they end. */
  | "count_hops"
  /** Count up from zero in equal steps until the total is reached. */
  | "forward_to_total";

export interface LineSetup {
  mode?: LineMode;
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

/** Totals stay inside 100 so the line can be drawn with readable tick spacing. */
const DEFAULTS: Record<LineMode, ModeDefaults> = {
  back_to_zero: { divisorRange: [2, 10], quotientRange: [2, 6], totalMax: 60 },
  count_hops: { divisorRange: [2, 10], quotientRange: [2, 8], totalMax: 80 },
  forward_to_total: { divisorRange: [2, 10], quotientRange: [3, 10], totalMax: 100 },
};

export interface LineQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: LineMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** The number of hops — the answer in all three modes. */
  answer: number;
  /** Which end the child starts from. */
  start: number;
  /** Where the hops go. */
  direction: "back" | "forward";
  /** True when the line is drawn complete and the child only reads it. */
  prefilled: boolean;
  tone: Tone;
}

const TONES: readonly Tone[] = ["sky", "violet", "emerald", "rose"] as const;

const PROMPTS: Record<LineMode, (q: Omit<LineQuestion, "prompt">) => string> = {
  back_to_zero: (q) => `Start at ${q.dividend} and hop back ${q.divisor} at a time. How many hops to reach 0?`,
  count_hops: (q) => `These hops are ${q.divisor} each. How many hops are there?`,
  forward_to_total: (q) => `Count up from 0 in ${q.divisor}s. How many hops to reach ${q.dividend}?`,
};

export function buildLineQuestion(
  setup: LineSetup,
  mode: LineMode,
  index: number,
  seen?: Set<string>,
): LineQuestion {
  const fallback = DEFAULTS[mode];
  const spec: Omit<QuotientSpec, "meaning"> = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [4, setup.totalMax ?? fallback.totalMax],
    remainder: "never",
  };

  const draw = (): GroupQuotient => drawGroupQuotient(spec);
  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const forward = mode === "forward_to_total";
  const tone = pick(TONES);
  const id = `division-${mode}-${index}-${value.dividend}-${value.divisor}`;

  const base = {
    id,
    taskKind: `division_${mode}`,
    expected: String(value.quotient),
    itemCount: value.quotient,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    answer: value.quotient,
    start: forward ? 0 : value.dividend,
    direction: forward ? ("forward" as const) : ("back" as const),
    prefilled: mode === "count_hops",
    tone,
  };

  return { ...base, prompt: PROMPTS[mode](base as Omit<LineQuestion, "prompt">) };
}

/**
 * The numbers a child could give, with the landing among them on purpose.
 *
 * Level 13 exists because "how many hops" and "where did you land" are two
 * different numbers and a child who has just watched a marker slide down a line
 * reaches for the one they were looking at. Offering it is the only way to find
 * out which one they meant.
 */
export function lineChoices(question: LineQuestion): number[] {
  const { quotient, divisor, dividend } = question;
  const candidates = [quotient, divisor, dividend, quotient + 1, dividend - divisor, quotient - 1];
  const out: number[] = [];
  for (const n of candidates) {
    if (!Number.isInteger(n) || n <= 0) continue;
    if (out.includes(n)) continue;
    out.push(n);
    if (out.length === 4) break;
  }
  return out;
}

/** Why the line will not take an answer yet. */
export type LineBlock = "not-finished" | "overshot" | null;

/**
 * The hops have to actually be made.
 *
 * `count_hops` is the exception and is drawn complete: it asks a child to read a
 * line rather than build one, and gating it on hops they were never asked to
 * make would be gating it on nothing.
 */
export function lineBlockedBecause(question: LineQuestion, position: number): LineBlock {
  if (question.prefilled) return null;
  const target = question.direction === "back" ? 0 : question.dividend;
  if (position === target) return null;
  const overshot =
    question.direction === "back" ? position < 0 : position > question.dividend;
  return overshot ? "overshot" : "not-finished";
}

export const LINE_REFUSALS: Record<Exclude<LineBlock, null>, string> = {
  "not-finished": "Keep hopping until you get all the way there.",
  overshot: "That is too far. Come back one hop.",
};
