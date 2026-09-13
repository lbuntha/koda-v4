/**
 * Divisibility, factors, and taking a number apart into primes.
 *
 * The thread through all six levels is that *division answers a yes-or-no
 * question too*: does this go exactly? A child who can only divide when told to
 * has half the tool. The tests are shortcuts for that question, and every one of
 * them is offered with its evidence on screen — the last digit, the digit sum,
 * the last two digits — because a rule learned without its reason is a rule
 * applied to the wrong number a year later.
 */

import { pick, shuffle } from "./divisionNumbers";

export type FactorMode =
  /** 2, 5 and 10 — decided by the last digit. */
  | "last_digit"
  /** 3 and 9 — decided by the digit sum. */
  | "digit_sum"
  /** 4 and 6 — the last two digits, and two tests at once. */
  | "combined_test"
  /** Every factor pair, found by dividing and stopping at the square root. */
  | "factor_pairs"
  /** The factors two numbers share. */
  | "common_factors"
  /** Taking a number apart until only primes are left. */
  | "prime_factors";

export interface FactorSetup {
  mode?: FactorMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  numberRange?: [number, number];
}

interface ModeDefaults {
  numberRange: [number, number];
  testers: number[];
}

const DEFAULTS: Record<FactorMode, ModeDefaults> = {
  last_digit: { numberRange: [20, 999], testers: [2, 5, 10] },
  digit_sum: { numberRange: [20, 999], testers: [3, 9] },
  combined_test: { numberRange: [20, 999], testers: [4, 6] },
  factor_pairs: { numberRange: [12, 120], testers: [] },
  common_factors: { numberRange: [12, 100], testers: [] },
  prime_factors: { numberRange: [12, 200], testers: [] },
};

export const digitSum = (n: number): number =>
  String(Math.abs(n))
    .split("")
    .reduce((sum, d) => sum + Number(d), 0);

/** Every factor pair, smaller side first, found the way the lesson teaches. */
export function factorPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 1; i * i <= n; i += 1) {
    if (n % i === 0) pairs.push([i, n / i]);
  }
  return pairs;
}

export const factorsOf = (n: number): number[] => {
  const out = new Set<number>();
  for (const [a, b] of factorPairs(n)) {
    out.add(a);
    out.add(b);
  }
  return [...out].sort((a, b) => a - b);
};

export const isPrime = (n: number): boolean => n > 1 && factorPairs(n).length === 1;

/** The primes a number is made of, smallest first. */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  let left = n;
  for (let p = 2; p * p <= left; p += 1) {
    while (left % p === 0) {
      out.push(p);
      left /= p;
    }
  }
  if (left > 1) out.push(left);
  return out;
}

/** The factor pairs a child can choose between when splitting a composite. */
export const splitOptions = (n: number): [number, number][] =>
  factorPairs(n).filter(([a]) => a > 1);

/**
 * The evidence a test is based on, written out.
 *
 * Returned as text rather than computed in the component so a test can assert
 * that the rule shown matches the rule the level claims — a "digit sum" lesson
 * quietly showing the last digit would look completely fine.
 */
export function evidenceFor(value: number, tester: number): string {
  if (tester === 2 || tester === 5 || tester === 10) {
    return `The last digit is ${value % 10}.`;
  }
  if (tester === 3 || tester === 9) {
    return `The digits add up to ${digitSum(value)}.`;
  }
  if (tester === 4) {
    return `The last two digits are ${String(value).slice(-2)}.`;
  }
  return `${value} is even: ${value % 2 === 0 ? "yes" : "no"}. Its digits add to ${digitSum(value)}.`;
}

export interface FactorQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: FactorMode;
  /** The number being tested or taken apart. */
  value: number;
  /** The second number, for common factors. */
  other?: number;
  /** What it is being tested by. */
  tester?: number;
  /** The evidence line for the test. */
  evidence?: string;
  /** Yes or no, for the testing modes. */
  divides?: boolean;
  /** Every factor a child has to find, for the collecting modes. */
  wanted: number[];
  /** The candidate divisors offered. */
  candidates: number[];
  /** Where the search can stop. */
  stopAt?: number;
  /** The primes, for the tree. */
  primes?: number[];
}

/**
 * A number that is a near miss, so the rule has to be used rather than guessed.
 *
 * A round of divisibility questions where every "no" is obviously no — an odd
 * number tested for 2 — teaches a child to answer from the look of the number.
 * These are drawn within one of a multiple, so looking is not enough.
 */
function nearMiss(tester: number, lo: number, hi: number): number {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const multiple = tester * (Math.ceil(lo / tester) + Math.floor(Math.random() * 20));
    const offset = pick([1, 2, tester - 1]);
    const candidate = multiple + offset;
    if (candidate >= lo && candidate <= hi && candidate % tester !== 0) return candidate;
  }
  return lo + 1;
}

export function buildFactorQuestion(
  setup: FactorSetup,
  mode: FactorMode,
  index: number,
): FactorQuestion {
  const fallback = DEFAULTS[mode];
  const [lo, hi] = setup.numberRange ?? fallback.numberRange;
  const id = `division-${mode}-${index}`;

  if (mode === "last_digit" || mode === "digit_sum" || mode === "combined_test") {
    const tester = pick(fallback.testers);
    // Half the round divides, half does not — and the half that does not is
    // always close enough that the rule has to be applied.
    const shouldDivide = index % 2 === 0;
    const value = shouldDivide
      ? tester * (Math.ceil(lo / tester) + Math.floor(Math.random() * ((hi - lo) / tester)))
      : nearMiss(tester, lo, hi);
    const divides = value % tester === 0;
    return {
      id: `${id}-${value}-${tester}`,
      taskKind: `division_${mode}`,
      prompt: `Does ${tester} divide into ${value} exactly?`,
      expected: divides ? "yes" : "no",
      itemCount: 1,
      mode,
      value,
      tester,
      evidence: evidenceFor(value, tester),
      divides,
      wanted: [],
      candidates: [],
    };
  }

  if (mode === "factor_pairs") {
    const value = lo + Math.floor(Math.random() * (hi - lo + 1));
    const wanted = factorsOf(value);
    return {
      id: `${id}-${value}`,
      taskKind: "division_factor_pairs",
      prompt: `Find every number that divides into ${value} exactly.`,
      expected: wanted.join(", "),
      itemCount: wanted.length,
      mode,
      value,
      wanted,
      candidates: Array.from({ length: Math.min(20, value) }, (_, i) => i + 1),
      stopAt: Math.floor(Math.sqrt(value)),
    };
  }

  if (mode === "common_factors") {
    /*
     * Two numbers that share more than the number one.
     *
     * A pair whose only common factor is 1 is a real answer and a terrible
     * question: there is nothing to find, and a child cannot tell "I have found
     * them all" from "I have not started".
     */
    let value = lo;
    let other = lo;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      value = lo + Math.floor(Math.random() * (hi - lo + 1));
      other = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (value === other) continue;
      const shared = factorsOf(value).filter((f) => other % f === 0);
      if (shared.length >= 3) break;
    }
    const wanted = factorsOf(value).filter((f) => other % f === 0);
    return {
      id: `${id}-${value}-${other}`,
      taskKind: "division_common_factors",
      prompt: `Which numbers divide into both ${value} and ${other}?`,
      expected: wanted.join(", "),
      itemCount: wanted.length,
      mode,
      value,
      other,
      wanted,
      candidates: Array.from({ length: 20 }, (_, i) => i + 1),
    };
  }

  // prime_factors
  let value = lo;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    value = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (!isPrime(value) && primeFactors(value).length >= 2) break;
  }
  const primes = primeFactors(value);
  return {
    id: `${id}-${value}`,
    taskKind: "division_prime_factors",
    prompt: `Break ${value} apart until only primes are left.`,
    expected: primes.join(" × "),
    itemCount: primes.length,
    mode,
    value,
    wanted: primes,
    candidates: [],
    primes,
  };
}

/** Candidate divisors in an order a child cannot learn. */
export const shuffledCandidates = (question: FactorQuestion): number[] =>
  shuffle(question.candidates);
