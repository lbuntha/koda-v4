/**
 * Remainders: writing them, bounding them, and — the part that actually matters
 * — reading what they mean in the situation being asked about.
 *
 * `17 ÷ 5 = 3 r 2` is one calculation and at least four different answers:
 *
 *   4  you need a fourth bus, because two children cannot be left behind
 *   3  you can fill three boxes, and the rest stay on the shelf
 *   2  two are left over, and that is what was asked
 *   3 r 2  both halves, because the question wanted the whole picture
 *
 * A child who can divide and cannot do this gets the arithmetic right and the
 * question wrong, which is the commonest way a word problem is failed. Levels 24
 * and 25 are the only place in the skill where the numbers stay the same and the
 * *question* is the variable.
 */

import { catalogRecord, td } from "../i18n";
import {
  drawQuotient,
  pick,
  quotientKey,
  shuffle,
  withoutRepeat,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";

export type RemainderMode =
  /** Write the quotient and the remainder. */
  | "record"
  /** Correct an answer whose remainder is too big. */
  | "too_big"
  /** The same numbers, asked four ways. */
  | "interpret"
  /** One situation, four candidate answers, one of them right. */
  | "choose_form";

/** What a situation wants back. */
export type Reading = "round-up" | "round-down" | "the-remainder" | "both";

export interface RemainderSetup {
  mode?: RemainderMode;
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

const DEFAULTS: Record<RemainderMode, ModeDefaults> = {
  record: { divisorRange: [2, 9], quotientRange: [2, 12], totalMax: 100 },
  too_big: { divisorRange: [3, 9], quotientRange: [2, 12], totalMax: 100 },
  interpret: { divisorRange: [3, 8], quotientRange: [2, 9], totalMax: 80 },
  choose_form: { divisorRange: [3, 8], quotientRange: [2, 9], totalMax: 80 },
};

/**
 * A situation, written four ways around one division.
 *
 * The nouns are shared across the four so that the *question* is the only thing
 * that changes. A different story for each reading would let a child sort them
 * by subject rather than by what is being asked.
 */
/*
 * Each situation's words are in the catalog under `remainder.situations.<id>`:
 * the shared opening ("17 children are going on a trip. Each bus holds 5."),
 * the four endings by what they want back, and the four written answers. The
 * answers are whole sentences rather than a number and a unit, because not
 * every language puts the unit after the number.
 */
type Situation = "bus" | "egg" | "pencil";

const SITUATIONS: readonly Situation[] = ["bus", "egg", "pencil"];

const READINGS: readonly Reading[] = ["round-up", "round-down", "the-remainder", "both"] as const;

/**
 * The number a reading wants.
 *
 * Takes only the three numbers rather than a whole `Quotient`, so a question
 * that has already been built can be handed straight to it.
 */
export const answerFor = (
  value: Pick<Quotient, "quotient" | "remainder">,
  reading: Reading,
): number => {
  switch (reading) {
    case "round-up":
      return value.quotient + 1;
    case "round-down":
      return value.quotient;
    case "the-remainder":
      return value.remainder;
    case "both":
      return value.quotient;
  }
};

export interface RemainderQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: RemainderMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** What this particular question wants back. */
  reading: Reading;
  /** True when the answer is a pair typed on the pad. */
  wantsPair: boolean;
  /** The wrong answer a child is being asked to correct, for `too_big`. */
  wrong?: { quotient: number; remainder: number };
  /** The situation, for the two story modes. */
  story?: string;
  /** Written candidate answers, for `choose_form`. */
  options?: string[];
}

export function buildRemainderQuestion(
  setup: RemainderSetup,
  mode: RemainderMode,
  index: number,
  seen?: Set<string>,
): RemainderQuestion {
  const fallback = DEFAULTS[mode];
  const spec: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [5, setup.totalMax ?? fallback.totalMax],
    // Every level here is about the leftover, so there is always one.
    remainder: "always",
  };

  const draw = () => drawQuotient(spec);
  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const id = `division-${mode}-${index}-${value.dividend}-${value.divisor}`;
  const reading: Reading = mode === "record" || mode === "too_big" ? "both" : READINGS[index % READINGS.length];

  const base = {
    id,
    taskKind: `division_${mode}`,
    itemCount: value.dividend,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    reading,
    wantsPair: reading === "both",
    expected: reading === "both" ? `${value.quotient} r ${value.remainder}` : String(answerFor(value, reading)),
  };

  if (mode === "record") {
    return { ...base, prompt: `${value.dividend} ÷ ${value.divisor}` };
  }

  if (mode === "too_big") {
    /*
     * A wrong answer with a remainder that will not fit.
     *
     * Built by moving whole groups out of the quotient and into the remainder,
     * so the total still adds up — `17 / 5 = 2 r 7` is arithmetic a child can
     * check and find *consistent*, which is the point: it is wrong because a
     * remainder of 7 means another 5 could have gone round, not because the
     * numbers do not balance.
     */
    const moved = 1 + Math.floor(Math.random() * Math.max(1, Math.min(2, value.quotient - 1)));
    return {
      ...base,
      prompt: `${value.dividend} ÷ ${value.divisor}`,
      wrong: { quotient: value.quotient - moved, remainder: value.remainder + moved * value.divisor },
    };
  }

  const situation = pick(SITUATIONS);
  const words = (key: string, vars?: Record<string, number>) => td(`remainder.situations.${situation}.${key}`, vars);
  const story = words("setup", { total: value.dividend, size: value.divisor });
  const prompt = words(`ask.${reading}`);

  if (mode === "choose_form") {
    /*
     * Four candidate answers in words, one per reading.
     *
     * Written out rather than offered as bare numbers because the level is about
     * which *kind* of answer the question wants — "4 buses" and "4 children left
     * over" are the same digit meaning two different things, and a child who
     * only ever picks digits never has to notice that.
     */
    const written: Record<Reading, string> = {
      "round-up": words("written.round-up", { q: value.quotient + 1 }),
      "round-down": words("written.round-down", { q: value.quotient }),
      "the-remainder": words("written.the-remainder", { r: value.remainder }),
      both: words("written.both", { q: value.quotient, r: value.remainder }),
    };
    return {
      ...base,
      prompt,
      story,
      wantsPair: false,
      expected: written[reading],
      options: shuffle(READINGS.map((r) => written[r])),
    };
  }

  return { ...base, prompt, story, wantsPair: reading === "both" };
}

/** Why the pair typed in will not be accepted yet. */
export type PairBlock = "remainder-too-big" | "incomplete" | null;

/**
 * The bound on a remainder, checked before the answer is marked.
 *
 * Refused rather than marked wrong, and for the reason level 23 exists: a
 * remainder that is not smaller than the divisor is not a wrong answer, it is an
 * unfinished one. Saying so is the teaching; a cross is not.
 */
export function pairBlockedBecause(
  question: RemainderQuestion,
  quotient: string,
  remainder: string,
): PairBlock {
  if (quotient === "" || remainder === "") return "incomplete";
  if (Number(remainder) >= question.divisor) return "remainder-too-big";
  return null;
}

export const PAIR_REFUSALS: Record<Exclude<PairBlock, null>, string> = catalogRecord("remainder.refusals", [
  "remainder-too-big",
  "incomplete",
]);
