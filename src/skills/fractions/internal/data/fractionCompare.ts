/**
 * Which is more — and the two levels where that is the wrong question.
 *
 * Comparing fractions is where the "3/4 is a 3 and a 4" belief does its worst
 * damage, because it gives the right answer about half the time. A child who
 * compares the bottom numbers gets `3/8 < 5/8` right and `1/8 > 1/4` wrong, and
 * nothing in a round of like denominators will ever tell them.
 *
 * So the five levels are arranged to take the belief apart rather than to drill
 * the skill:
 *
 *   17  same bottom      count the pieces; the belief works here, and is not tested
 *   18  same top         the belief fails; the whole level exists for it
 *   19  different wholes the question cannot be answered at all
 *   20  against a half   a benchmark, rather than the other fraction
 *   21  different bottoms make the pieces match first, then count
 *
 * Level 19's right answer is "you cannot tell", and it is the only level in the
 * skill where refusing to answer is the answer.
 */

import {
  canPartition,
  drawPair,
  gcd,
  lcm,
  pick,
  randInt,
  shuffle,
  valueOf,
  WHOLES,
  withoutRepeat,
  type Fraction,
  type PairSpec,
  type Whole,
} from "./fractionNumbers";

export type CompareMode =
  /** Same denominator: the pieces are the same size, so count them. */
  | "same_denominator"
  /** Same numerator: the same number of pieces, but the pieces differ. */
  | "same_numerator"
  /** Two different wholes: the comparison cannot be made. */
  | "different_wholes"
  /** Against one half, rather than against the other fraction. */
  | "benchmark_half"
  /** Different denominators: re-cut both until the pieces match. */
  | "common_denominator";

export interface CompareSetup {
  mode?: CompareMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
}

const DEFAULTS: Record<CompareMode, [number, number]> = {
  same_denominator: [3, 12],
  same_numerator: [2, 12],
  different_wholes: [2, 8],
  benchmark_half: [3, 12],
  common_denominator: [2, 8],
};

/** What a child can say about two fractions. */
export type Verdict = "less" | "same" | "more" | "cannot-tell";

export interface CompareQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: Verdict;
  itemCount: number;
  mode: CompareMode;
  left: Fraction;
  right: Fraction;
  /** True when "you cannot tell" is among the answers. */
  offersCannotTell: boolean;
  /** True when the child must re-cut both before answering. */
  mustMatch: boolean;
  /** The denominator both fractions become once matched. */
  common?: number;
  /** The benchmark being compared against, where there is one. */
  benchmark?: Fraction;
}

/** Which way round two fractions of the same whole sit. */
export const verdictFor = (left: Fraction, right: Fraction): Verdict => {
  const a = valueOf(left);
  const b = valueOf(right);
  if (a < b) return "less";
  if (a > b) return "more";
  return "same";
};

const HALF_NAME = "one half";

const PROMPTS: Record<CompareMode, (q: Omit<CompareQuestion, "prompt">) => string> = {
  same_denominator: () => "Which is more?",
  same_numerator: () => "Which is more?",
  different_wholes: () => "Which is more?",
  benchmark_half: (q) => `Is ${q.left.taken}/${q.left.parts} more or less than a half?`,
  common_denominator: () => "Which is more?",
};

export function buildCompareQuestion(
  setup: CompareSetup,
  mode: CompareMode,
  index: number,
  seen?: Set<string>,
): CompareQuestion {
  const partsRange = setup.partsRange ?? DEFAULTS[mode];
  const id = (l: Fraction, r: Fraction) =>
    `fractions-${mode}-${index}-${l.taken}/${l.parts}-${r.taken}/${r.parts}`;

  if (mode === "benchmark_half") {
    /*
     * A benchmark is only useful when the answer is not obvious, so the
     * numerator sits within one of half the denominator. `5/12` against a half
     * is a judgement; `1/12` against a half is a glance.
     */
    let parts = randInt(partsRange[0], partsRange[1]);
    for (let i = 0; i < 40 && parts < 3; i += 1) parts = randInt(partsRange[0], partsRange[1]);
    const half = parts / 2;
    /*
     * The nearest a fraction can get to a half depends on whether the
     * denominator is even.
     *
     * With an even one, `half` is a whole number of pieces and the neighbours
     * sit a full piece away — and `half` itself is a real answer worth asking
     * for, because "exactly a half" is a thing a child should be able to say.
     * With an odd one there is no exact half at all, and the two nearest values
     * straddle it by half a piece each. Offsetting by a whole piece there lands
     * one and a half pieces out, which is far enough that a glance settles it —
     * and a benchmark question a glance settles is not a benchmark question.
     */
    const candidates =
      parts % 2 === 0
        ? [half - 1, half, half + 1]
        : [Math.floor(half), Math.ceil(half)];
    const taken = Math.max(1, Math.min(parts - 1, pick(candidates)));
    const whole: Whole = { kind: "bar", name: "the strip" };
    const left: Fraction = { whole, parts, taken };
    const benchmark: Fraction = { whole, parts: 2, taken: 1 };
    const base = {
      id: id(left, benchmark),
      taskKind: `fractions_${mode}`,
      itemCount: parts,
      mode,
      left,
      right: benchmark,
      benchmark,
      offersCannotTell: false,
      mustMatch: false,
      expected: verdictFor(left, benchmark),
    };
    return { ...base, prompt: PROMPTS.benchmark_half(base as Omit<CompareQuestion, "prompt">) };
  }

  const spec: PairSpec = {
    partsRange,
    wholeKinds: ["bar"],
    proper: "always",
    distinct: mode !== "same_denominator" ? true : true,
    sameWhole: mode !== "different_wholes",
    sameNumerator: mode === "same_numerator",
    related:
      mode === "same_denominator"
        ? "same"
        : mode === "same_numerator"
          ? "coprime"
          : mode === "common_denominator"
            ? index % 2 === 0
              ? "nested"
              : "coprime"
            : "any",
  };

  const draw = () => drawPair(spec);
  const pair = seen
    ? withoutRepeat(draw, (p) => `${p.left.taken}/${p.left.parts}:${p.right.taken}/${p.right.parts}`, seen)
    : draw();
  const { left, right } = pair;

  const base = {
    id: id(left, right),
    taskKind: `fractions_${mode}`,
    itemCount: Math.max(left.parts, right.parts),
    mode,
    left,
    right,
    offersCannotTell: mode === "different_wholes",
    mustMatch: mode === "common_denominator",
    common: mode === "common_denominator" ? lcm(left.parts, right.parts) : undefined,
    /*
     * Two fractions of two different wholes cannot be compared, and that is the
     * answer rather than an obstacle to one. Everywhere else the bars are the
     * same length, which is what makes looking at them a valid method.
     */
    expected: mode === "different_wholes" ? ("cannot-tell" as Verdict) : verdictFor(left, right),
  };

  return { ...base, prompt: PROMPTS[mode](base as Omit<CompareQuestion, "prompt">) };
}

/* -------------------------------------------------------------------------- */
/* Making the pieces match                                                     */
/* -------------------------------------------------------------------------- */

/** Both fractions re-cut to a denominator they share. */
export const matched = (q: CompareQuestion): { left: Fraction; right: Fraction } => {
  const common = lcm(q.left.parts, q.right.parts);
  return {
    left: { ...q.left, parts: common, taken: q.left.taken * (common / q.left.parts) },
    right: { ...q.right, parts: common, taken: q.right.taken * (common / q.right.parts) },
  };
};

/** Why the comparison will not be taken yet. */
export type CompareBlock = "pieces-differ" | null;

/**
 * Level 21 will not accept a verdict until the pieces are the same size.
 *
 * Not fussiness: "which is more" is a question about counting, and counting two
 * different-sized things is what the whole misconception consists of. Refusing
 * with "the pieces are different sizes, so you cannot count them yet" names the
 * reason; accepting a lucky guess would confirm the method that produced it.
 */
export function compareBlockedBecause(q: CompareQuestion, matchedYet: boolean): CompareBlock {
  if (!q.mustMatch || matchedYet) return null;
  return "pieces-differ";
}

export const COMPARE_REFUSALS: Record<Exclude<CompareBlock, null>, string> = {
  "pieces-differ": "The pieces are different sizes. Make them match before you count.",
};

/** The answers offered, in the order they are shown. */
export const verdictsFor = (q: CompareQuestion): Verdict[] =>
  q.offersCannotTell ? ["less", "same", "more", "cannot-tell"] : ["less", "same", "more"];

export const VERDICT_WORDS: Record<Verdict, string> = {
  less: "the top one is less",
  same: "they are the same",
  more: "the top one is more",
  "cannot-tell": "you cannot tell",
};

export const BENCHMARK_WORDS: Record<Verdict, string> = {
  less: "less than a half",
  same: "exactly a half",
  more: "more than a half",
  "cannot-tell": "you cannot tell",
};

export { canPartition, gcd, lcm, shuffle, valueOf, WHOLES, HALF_NAME };
