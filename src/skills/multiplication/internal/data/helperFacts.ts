/**
 * The derived-fact ladder, as data.
 *
 * Every multiplication fact above the foundational set is reachable from a fact
 * the child already knows. This file is the whole map: which helper, in which
 * order, and what to do with its product. `FactDeck` reads it; no mode holds a
 * table of its own and no lesson branches on a level number.
 *
 * That is what lets the nine derived-fact lessons ship as JSON rather than as
 * nine components — and it is why the plan's Phase 6 is an architecture check.
 *
 * Two invariants hold for every row and are proved in the numbers test:
 *
 *   1. `applyAdjust` on the helper products reconstructs the target exactly.
 *   2. Every helper is taught at a strictly lower level than its target, so a
 *      lesson can never ask a child to derive a fact from one they have not met.
 */

/* -------------------------------------------------------------------------- */
/* Strategies                                                                  */
/* -------------------------------------------------------------------------- */

export type FactStrategy =
  | "doubles"
  | "tens"
  | "fives"
  | "double_double"
  | "triple_double"
  | "add_a_group"
  | "subtract_a_group"
  | "break_apart"
  | "near_square";

/** The three facts a child is expected to know outright before deriving any other. */
export const FOUNDATIONAL: readonly FactStrategy[] = ["doubles", "tens", "fives"] as const;

export const isFoundational = (strategy: FactStrategy): boolean =>
  FOUNDATIONAL.includes(strategy);

/**
 * What turns the helper products into the target product.
 *
 * `sum` adds every helper product; the others operate on the last one, which is
 * the order the helper chain is presented in.
 */
export type Adjust =
  | { kind: "double" }
  | { kind: "halve" }
  | { kind: "add_group"; of: number }
  | { kind: "subtract_group"; of: number }
  | { kind: "sum" };

export type Fact = readonly [number, number];

export interface HelperFact {
  /** The fact being derived. The first factor is the one the strategy names. */
  target: Fact;
  strategy: FactStrategy;
  /** Facts the child already knows, in the order the helper card shows them. */
  helpers: readonly Fact[];
  adjust: Adjust;
  /** The master-table level that teaches this fact. */
  level: number;
}

export const productOf = (fact: Fact): number => fact[0] * fact[1];

/** Turn the helper products into the target product. */
export function applyAdjust(helperProducts: readonly number[], adjust: Adjust): number {
  if (helperProducts.length === 0) {
    throw new RangeError("helperFacts: an adjustment needs at least one helper product");
  }
  const last = helperProducts[helperProducts.length - 1];
  switch (adjust.kind) {
    case "double":
      return last * 2;
    case "halve":
      return last / 2;
    case "add_group":
      return last + adjust.of;
    case "subtract_group":
      return last - adjust.of;
    case "sum":
      return helperProducts.reduce((total, value) => total + value, 0);
  }
}

/** The product a helper chain arrives at, without consulting the target. */
export const derivedProduct = (fact: HelperFact): number =>
  applyAdjust(fact.helpers.map(productOf), fact.adjust);

/* -------------------------------------------------------------------------- */
/* When each fact becomes available                                            */
/* -------------------------------------------------------------------------- */

/** The partner range every table is drilled across. */
export const PARTNER_MIN = 2;
export const PARTNER_MAX = 12;

/**
 * The level at which each times table is taught, keyed by its driving factor.
 *
 * Zero and one are properties rather than tables, which is why they sit at
 * levels 6 and 7 rather than with the fact ladder.
 */
export const FACTOR_LEVEL: Readonly<Record<number, number>> = Object.freeze({
  0: 7,
  1: 6,
  2: 17,
  3: 26,
  4: 24,
  5: 19,
  6: 27,
  7: 29,
  8: 25,
  9: 28,
  10: 18,
  11: 30,
  12: 30,
});

/** Square numbers are taught as a set at level 22, ahead of the tables they sit in. */
const SQUARES_LEVEL = 22;

/**
 * The earliest level at which a child can be expected to know a fact.
 *
 * Either factor will do: commutativity is level 10, so `4 × 2` is known as soon
 * as the twos are, long before the fours. Squares arrive at 22 as a diagonal,
 * whichever tables they belong to.
 */
export function factLevel(fact: Fact): number {
  const [a, b] = fact;
  /*
   * A table only makes a fact known across its own partner range.
   *
   * Crediting the fours for 13 x 4 was the first version of this, and it would
   * have let a lesson derive a fact from a helper no table in this skill ever
   * teaches - silently, because the arithmetic is still correct.
   */
  const inRange = (n: number): boolean => n >= 0 && n <= PARTNER_MAX;
  const candidates: number[] = [];
  if (FACTOR_LEVEL[a] !== undefined && inRange(b)) candidates.push(FACTOR_LEVEL[a]);
  if (FACTOR_LEVEL[b] !== undefined && inRange(a)) candidates.push(FACTOR_LEVEL[b]);
  if (a === b && inRange(a)) candidates.push(SQUARES_LEVEL);
  if (candidates.length === 0) {
    throw new RangeError(`helperFacts: no level is known for ${a} \u00d7 ${b}`);
  }
  return Math.min(...candidates);
}

/** Every helper of this fact is taught strictly before the fact itself. */
export const helpersArriveFirst = (fact: HelperFact): boolean =>
  fact.helpers.every((helper) => factLevel(helper) < fact.level);

/* -------------------------------------------------------------------------- */
/* The table                                                                   */
/* -------------------------------------------------------------------------- */

const partners = (): number[] => {
  const out: number[] = [];
  for (let n = PARTNER_MIN; n <= PARTNER_MAX; n += 1) out.push(n);
  return out;
};

/**
 * One row per derivable fact.
 *
 * Built from the per-table rule rather than typed out a hundred and thirty
 * times, so a change to a strategy cannot leave half its facts behind. The
 * result is still a table: frozen, enumerable, and checked entry by entry.
 */
function buildLadder(): HelperFact[] {
  const rows: HelperFact[] = [];

  for (const n of partners()) {
    // Four is two doubles. Eight is three.
    rows.push({
      target: [4, n], strategy: "double_double",
      helpers: [[2, n]], adjust: { kind: "double" }, level: FACTOR_LEVEL[4],
    });
    rows.push({
      target: [8, n], strategy: "triple_double",
      helpers: [[2, n], [4, n]], adjust: { kind: "double" }, level: FACTOR_LEVEL[8],
    });

    // Three is the double and one more group; six is the five and one more.
    rows.push({
      target: [3, n], strategy: "add_a_group",
      helpers: [[2, n]], adjust: { kind: "add_group", of: n }, level: FACTOR_LEVEL[3],
    });
    rows.push({
      target: [6, n], strategy: "add_a_group",
      helpers: [[5, n]], adjust: { kind: "add_group", of: n }, level: FACTOR_LEVEL[6],
    });

    // Nine is the ten with one group given back.
    rows.push({
      target: [9, n], strategy: "subtract_a_group",
      helpers: [[10, n]], adjust: { kind: "subtract_group", of: n }, level: FACTOR_LEVEL[9],
    });

    // Seven breaks into five and two; eleven and twelve into ten and the rest.
    rows.push({
      target: [7, n], strategy: "break_apart",
      helpers: [[5, n], [2, n]], adjust: { kind: "sum" }, level: FACTOR_LEVEL[7],
    });
    rows.push({
      target: [11, n], strategy: "break_apart",
      helpers: [[10, n], [1, n]], adjust: { kind: "sum" }, level: FACTOR_LEVEL[11],
    });
    rows.push({
      target: [12, n], strategy: "break_apart",
      helpers: [[10, n], [2, n]], adjust: { kind: "sum" }, level: FACTOR_LEVEL[12],
    });
  }

  // A near square is its square and one more of the smaller side.
  for (let n = 3; n <= PARTNER_MAX - 1; n += 1) {
    rows.push({
      target: [n, n + 1], strategy: "near_square",
      helpers: [[n, n]], adjust: { kind: "add_group", of: n }, level: 31,
    });
  }

  // Halving the ten is what makes five foundational rather than memorised.
  for (const n of partners()) {
    rows.push({
      target: [5, n], strategy: "fives",
      helpers: [[10, n]], adjust: { kind: "halve" }, level: FACTOR_LEVEL[5],
    });
  }

  return rows;
}

export const HELPER_FACTS: readonly HelperFact[] = Object.freeze(buildLadder());

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

const sameFact = (one: Fact, two: Fact): boolean =>
  (one[0] === two[0] && one[1] === two[1]) || (one[0] === two[1] && one[1] === two[0]);

/** Every way this fact can be derived, newest strategies last. */
export const strategiesFor = (fact: Fact): HelperFact[] =>
  HELPER_FACTS.filter((row) => sameFact(row.target, fact));

/** The row for one fact under one named strategy. */
export const helperFor = (fact: Fact, strategy: FactStrategy): HelperFact | undefined =>
  HELPER_FACTS.find((row) => row.strategy === strategy && sameFact(row.target, fact));

/** Every fact a given strategy can derive. */
export const factsForStrategy = (strategy: FactStrategy): HelperFact[] =>
  HELPER_FACTS.filter((row) => row.strategy === strategy);

/**
 * The derivations a child at this level may be offered.
 *
 * Used by `known_fact`, where the child chooses the helper: offering a route
 * through a table they have not met yet is the failure this guards.
 */
export const availableAt = (fact: Fact, level: number): HelperFact[] =>
  strategiesFor(fact).filter(
    (row) => row.level <= level && row.helpers.every((helper) => factLevel(helper) <= level),
  );
