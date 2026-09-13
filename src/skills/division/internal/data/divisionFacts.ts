/**
 * The fact deck: division answered from multiplication a child already has.
 *
 * The whole of levels 15-21 is one idea — *you already know this* — approached
 * seven ways. A card shows a division; a helper card shows the multiplication
 * that answers it; the child reads across. What changes between modes is how
 * much of the helper is given and how much they have to find.
 *
 * **A planned reuse that did not survive contact.** The build plan had level 16
 * pointing at `multiplication/table` · `find_cell` on the grounds that finding a
 * cell is one finger action taught once. It is — but `find_cell` asks "what is
 * 7 x 8?", and a lesson titled "Divide with the times table" that asks a child
 * to multiply is exactly the silent mismatch §0 warns about. `table_divide`
 * below asks the opposite question of the same grid: find the *total* somewhere
 * in a row, and read off which column it is in. Same picture, division's
 * question, and no lesson claiming to teach something it does not.
 */

import {
  drawQuotient,
  pick,
  quotientDistractors,
  quotientKey,
  shuffle,
  withoutRepeat,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";

/**
 * The three numbers these helpers need, and nothing else.
 *
 * Narrower than `Quotient` on purpose: none of them cares which *meaning* a
 * question carries, and asking for a whole quotient would stop a test handing
 * one of them a question it had already built.
 */
export type Triple = Pick<Quotient, "dividend" | "divisor" | "quotient">;

export type FactMode =
  /** Four equations from three numbers. */
  | "family"
  /** Find the total in a row of the times table; read its column. */
  | "table_divide"
  /** `7 x ? = 56` and `56 ÷ 7 = ?` are one question. */
  | "missing_factor"
  /** Divide by 2, 5 or 10. */
  | "easy_divisors"
  /** Divide by 4 or 8 by halving again. */
  | "repeated_halving"
  /** Divide by 3, 6 or 9 from the multiplication that matches. */
  | "known_multiple"
  /** Choose your own helper fact, then use it. */
  | "known_fact";

export interface FactSetup {
  mode?: FactMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  divisorRange?: [number, number];
  quotientRange?: [number, number];
  /** How far the times table runs. Division follows multiplication's ceiling. */
  tableCeiling?: number;
}

interface ModeDefaults {
  divisorRange: [number, number];
  quotientRange: [number, number];
  /** Divisors this mode is actually about, when it is about particular ones. */
  divisors?: number[];
}

const DEFAULTS: Record<FactMode, ModeDefaults> = {
  // A square makes "four facts from three numbers" into two: `4 x 4` and
  // `16 / 4` each say themselves twice. The level's whole claim fails on it.
  family: { divisorRange: [2, 12], quotientRange: [2, 12] },
  table_divide: { divisorRange: [2, 12], quotientRange: [2, 12] },
  missing_factor: { divisorRange: [2, 12], quotientRange: [2, 12] },
  easy_divisors: { divisorRange: [2, 10], quotientRange: [2, 12], divisors: [2, 5, 10] },
  repeated_halving: { divisorRange: [4, 8], quotientRange: [2, 12], divisors: [4, 8] },
  known_multiple: { divisorRange: [3, 9], quotientRange: [2, 12], divisors: [3, 6, 9] },
  known_fact: { divisorRange: [2, 12], quotientRange: [2, 12] },
};

export interface FactQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: FactMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  answer: number;
  /** The multiplication that answers it, written as a question. */
  helper: string;
  /** The halving chain, for the mode that halves twice. */
  chain?: string[];
  /** Every equation offered, for `family`. */
  equations?: string[];
  /** Which of them are true. */
  trueEquations?: string[];
  /** The row of the times table, for `table_divide`. */
  row?: number[];
  /** Helper facts to choose between, for `known_fact`. */
  helperChoices?: string[];
  /** The one that helps. */
  helperAnswer?: string;
  choices: number[];
}

const PROMPTS: Record<FactMode, (q: Omit<FactQuestion, "prompt">) => string> = {
  family: (q) => `Which of these are true for ${q.divisor}, ${q.quotient} and ${q.dividend}?`,
  table_divide: (q) => `Find ${q.dividend} in the ${q.divisor} row. Which column is it in?`,
  missing_factor: (q) => `${q.divisor} × ? = ${q.dividend}. What is ${q.dividend} ÷ ${q.divisor}?`,
  easy_divisors: (q) => `${q.dividend} ÷ ${q.divisor}`,
  repeated_halving: (q) => `${q.dividend} ÷ ${q.divisor}`,
  known_multiple: (q) => `${q.dividend} ÷ ${q.divisor}`,
  known_fact: (q) => `${q.dividend} ÷ ${q.divisor}`,
};

/**
 * The four true equations three numbers make, and three that look like them.
 *
 * The wrong ones are wrong by role, not by value: `56 ÷ 8 = 8` and `7 x 56 = 8`
 * use the same three numbers a child is holding, which is the point — the
 * question is whether they know what each one *is*, not whether they can spot an
 * odd number out.
 */
export function familyEquations(value: Triple): { all: string[]; correct: string[] } {
  const { dividend: n, divisor: a, quotient: b } = value;
  const correct = [
    `${a} × ${b} = ${n}`,
    `${b} × ${a} = ${n}`,
    `${n} ÷ ${a} = ${b}`,
    `${n} ÷ ${b} = ${a}`,
  ];
  const wrong = [
    `${a} × ${n} = ${b}`,
    `${n} ÷ ${a} = ${a}`,
    `${a} ÷ ${n} = ${b}`,
  ];
  return { all: shuffle([...correct, ...wrong]), correct };
}

/** The helper, written as the question it answers rather than as its answer. */
const helperFor = (value: Quotient, mode: FactMode): string => {
  if (mode === "repeated_halving") return `Halve it, then halve again`;
  return `${value.divisor} × ? = ${value.dividend}`;
};

/** Halving down to the answer, one step per line. */
export function halvingChain(value: Triple): string[] {
  const steps: string[] = [];
  let current = value.dividend;
  let halvings = value.divisor === 4 ? 2 : 3;
  while (halvings > 0) {
    steps.push(`${current} ÷ 2 = ${current / 2}`);
    current /= 2;
    halvings -= 1;
  }
  return steps;
}

/**
 * Four multiplications to choose between, one of which actually helps.
 *
 * The three that do not are near neighbours — the right divisor with the wrong
 * partner, or the right partner with the wrong divisor — so choosing is an act
 * of checking rather than of recognition.
 */
export function helperOptions(value: Triple): { all: string[]; correct: string } {
  const { divisor: a, quotient: b, dividend: n } = value;
  const correct = `${a} × ${b} = ${n}`;
  /*
   * Three near neighbours, and never fewer.
   *
   * Built from a pool rather than a fixed trio because the obvious trio
   * collapses at the edges: with a quotient of 2, "one less than the quotient"
   * clamps back to 2 and rebuilds the right answer, and the question ships with
   * three options instead of four. The pool is walked in order of nearness and
   * stops at three, so an ordinary question still gets the closest ones.
   */
  const pool = [
    [a, b + 1],
    [a + 1, b],
    [a, b - 1],
    [a - 1, b],
    [a, b + 2],
    [a + 2, b],
    [a + 1, b + 1],
  ];
  const near: string[] = [];
  for (const [x, y] of pool) {
    if (x < 2 || y < 2) continue;
    const product = x * y;
    // Anything that also reaches the total is a second right answer.
    if (product === n) continue;
    const text = `${x} × ${y} = ${product}`;
    if (text === correct || near.includes(text)) continue;
    near.push(text);
    if (near.length === 3) break;
  }
  if (near.length < 3) {
    throw new Error(`divisionFacts: only ${near.length} helper distractors for ${n} ÷ ${a}`);
  }
  return { all: shuffle([correct, ...near]), correct };
}

export function buildFactQuestion(
  setup: FactSetup,
  mode: FactMode,
  index: number,
  seen?: Set<string>,
): FactQuestion {
  const fallback = DEFAULTS[mode];
  const ceiling = setup.tableCeiling ?? 12;
  const divisors = fallback.divisors;
  const spec: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: [
      (setup.quotientRange ?? fallback.quotientRange)[0],
      Math.min((setup.quotientRange ?? fallback.quotientRange)[1], ceiling),
    ],
    remainder: "never",
    distinctSides: mode === "family",
  };

  /*
   * A mode about particular divisors draws its divisor first.
   *
   * `easy_divisors` is a lesson about 2, 5 and 10; letting the range draw 7 once
   * in a while would make it a lesson about nothing in particular that happened
   * to mention halving.
   */
  const draw = (): Quotient => {
    if (!divisors) return drawQuotient(spec);
    const divisor = pick(divisors);
    return drawQuotient({ ...spec, divisorRange: [divisor, divisor] });
  };

  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
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
    helper: helperFor(value, mode),
    choices: shuffle([value.quotient, ...quotientDistractors(value, 3).map((d) => d.value)]),
  };

  const prompt = PROMPTS[mode](base as Omit<FactQuestion, "prompt">);

  if (mode === "family") {
    const { all, correct } = familyEquations(value);
    return { ...base, prompt, equations: all, trueEquations: correct, expected: correct.join(" | ") };
  }
  if (mode === "table_divide") {
    return {
      ...base,
      prompt,
      row: Array.from({ length: ceiling }, (_, i) => value.divisor * (i + 1)),
    };
  }
  if (mode === "repeated_halving") {
    return { ...base, prompt, chain: halvingChain(value) };
  }
  if (mode === "known_fact") {
    const { all, correct } = helperOptions(value);
    return { ...base, prompt, helperChoices: all, helperAnswer: correct };
  }
  return { ...base, prompt };
}
