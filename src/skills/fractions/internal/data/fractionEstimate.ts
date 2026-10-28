/**
 * Judging before calculating.
 *
 * These two levels ask for an opinion and refuse to accept working. That is
 * deliberate and it is the whole point: a child who cannot say roughly what
 * `7/8 + 9/10` is has no way of noticing when their arithmetic gives `16/18`.
 * Estimation is not a lesser form of calculation — it is the only check a
 * person carries with them after they leave school.
 *
 * Level 50's wrong claims are always the added-denominators kind, never off by
 * a little. "Could 1/2 + 1/3 be 2/5?" is answerable by anybody who knows that
 * a half is a half; "could it be 0.84?" is not, and a level that asked it would
 * be teaching children to distrust answers they cannot check.
 */

import {
  partWord,
  pick,
  randInt,
  shuffle,
  simplify,
  valueOf,
  withoutRepeat,
  type Fraction,
  type Whole,
} from "./fractionNumbers";
import { tf } from "../i18n";

export type EstimateMode =
  /** Nearest to nothing, a half, or one whole. */
  | "benchmark"
  /** Could that answer be right? */
  | "reasonable";

export interface EstimateSetup {
  mode?: EstimateMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
}

const BAR: Whole = { kind: "bar", name: "the strip" };

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

/** The three places a fraction can be nearest to. */
export type Benchmark = "nothing" | "half" | "one";

export const BENCHMARK_WORDS: Record<Benchmark, string> = {
  get nothing() { return tf("est.bNothing"); },
  get half() { return tf("est.bHalf"); },
  get one() { return tf("est.bOne"); },
};

/**
 * Which of the three a fraction is nearest to.
 *
 * Ties go nowhere: a fraction exactly between two benchmarks is not drawn, so
 * this never has to arbitrate. `3/8` is nearer a half than nothing and a child
 * can see that on a strip; `1/4` is exactly between them and the honest answer
 * is "neither", which is not one of the buttons.
 */
export function benchmarkOf(f: Fraction): Benchmark {
  const value = valueOf(f);
  const distances: [Benchmark, number][] = [
    ["nothing", Math.abs(value - 0)],
    ["half", Math.abs(value - 0.5)],
    ["one", Math.abs(value - 1)],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

/** How far a fraction is from the benchmark it is not nearest to. */
const clearlyNearest = (f: Fraction): boolean => {
  const value = valueOf(f);
  const gaps = [Math.abs(value), Math.abs(value - 0.5), Math.abs(value - 1)].sort((a, b) => a - b);
  // A quarter is the same distance from nothing and from a half. Anything
  // closer than a tenth of a whole to a tie is not asked.
  return gaps[1] - gaps[0] > 0.1;
};

export interface EstimateQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: EstimateMode;
  fraction: Fraction;
  /** Level 50's sum, and the claim about it. */
  left?: Fraction;
  right?: Fraction;
  claim?: Fraction;
  /** What is wrong with the claim, where something is. */
  verdict?: "right" | "too-small" | "too-big";
  options: string[];
}

const PROMPTS: Record<EstimateMode, (q: Omit<EstimateQuestion, "prompt">) => string> = {
  benchmark: (q) => tf("est.promptBench", { fraction: nameOf(q.fraction) }),
  reasonable: (q) =>
    tf("est.promptClaim", { left: nameOf(q.left as Fraction), right: nameOf(q.right as Fraction), claim: nameOf(q.claim as Fraction) }),
};

const VERDICT_WORDS: Record<NonNullable<EstimateQuestion["verdict"]>, string> = {
  get right() { return tf("est.vRight"); },
  get "too-small"() { return tf("est.vSmall"); },
  get "too-big"() { return tf("est.vBig"); },
};

export function buildEstimateQuestion(
  setup: EstimateSetup,
  mode: EstimateMode,
  index: number,
  seen?: Set<string>,
): EstimateQuestion {
  const [loParts, hiParts] = setup.partsRange ?? [3, 12];

  const draw = (): EstimateQuestion => {
    if (mode === "benchmark") {
      let f: Fraction = { whole: BAR, parts: 4, taken: 1 };
      for (let i = 0; i < 60; i += 1) {
        const parts = randInt(Math.max(3, loParts), hiParts);
        f = { whole: BAR, parts, taken: randInt(1, parts - 1) };
        if (clearlyNearest(f)) break;
      }
      const answer = benchmarkOf(f);
      return {
        id: `fractions-benchmark-${index}-${nameOf(f)}`,
        taskKind: "fractions_benchmark",
        prompt: "",
        expected: BENCHMARK_WORDS[answer],
        itemCount: f.parts,
        mode,
        fraction: f,
        options: ["nothing", "half", "one"].map((b) => BENCHMARK_WORDS[b as Benchmark]),
      };
    }

    /*
     * Level 50: a claim that is either sound or wrong in the one way that
     * matters.
     *
     * The wrong ones add the denominators, which always lands below both of the
     * fractions being added — so the disproof is "that is smaller than what you
     * started with", which needs no arithmetic at all. The right ones are the
     * true sum, so "no" is not a free answer.
     */
    const pairs: [number, number][] = [
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 5],
      [3, 8],
      [5, 6],
    ];
    const [p, q] = pick(pairs);
    const left: Fraction = { whole: BAR, parts: p, taken: 1 };
    const right: Fraction = { whole: BAR, parts: q, taken: 1 };
    const common = p * q;
    const truth = simplify({ whole: BAR, parts: common, taken: q + p });
    const sound = index % 2 === 0;
    const claim = sound ? truth : { whole: BAR, parts: p + q, taken: 2 };
    const verdict: EstimateQuestion["verdict"] = sound
      ? "right"
      : valueOf(claim) < valueOf(truth)
        ? "too-small"
        : "too-big";
    return {
      id: `fractions-reasonable-${index}-${p}-${q}-${sound ? "true" : "false"}`,
      taskKind: "fractions_reasonable",
      prompt: "",
      expected: VERDICT_WORDS[verdict],
      itemCount: common,
      mode,
      fraction: truth,
      left,
      right,
      claim,
      verdict,
      options: shuffle(Object.values(VERDICT_WORDS)),
    };
  };

  const built = seen ? withoutRepeat(draw, (q) => q.id.split("-").slice(2).join("-"), seen) : draw();
  return { ...built, prompt: PROMPTS[mode](built as Omit<EstimateQuestion, "prompt">) };
}

/** Every level here asks for one of a fixed set of words. */
export function isEstimateCorrect(q: EstimateQuestion, given: string): boolean {
  return given === q.expected;
}

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                          */
/* -------------------------------------------------------------------------- */

export function explainEstimate(q: EstimateQuestion, correct: boolean): string {
  if (!correct) {
    return q.mode === "benchmark"
      ? tf("est.missBench")
      : tf("est.missClaim");
  }

  if (q.mode === "benchmark") {
    const answer = benchmarkOf(q.fraction);
    const piece = partWord(q.fraction.parts, true);
    return answer === "half"
      ? tf("est.rightHalf", { taken: q.fraction.taken, parts: q.fraction.parts, words: piece })
      : answer === "one"
        ? tf("est.rightOne", { taken: q.fraction.taken, parts: q.fraction.parts, words: piece })
        : tf("est.rightNothing", { taken: q.fraction.taken, parts: q.fraction.parts, words: piece });
  }

  return q.verdict === "right"
    ? tf("est.rightSound")
    : tf("est.rightUnsound");
}

export { partWord, simplify, valueOf };
