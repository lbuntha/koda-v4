import { placeValueSplit } from "./multiplicationNumbers";

/**
 * The routes to a product, and which of them actually fit a given pair.
 *
 * Level 56 has no single right answer, and that is the point of it: a child who
 * reaches `16 × 5` by halving and doubling has done as well as one who split it
 * into `10 × 5` and `6 × 5`. Scoring one route over another would teach the
 * opposite of the lesson, so this file's job is to say which routes *genuinely
 * fit* — every one of those is accepted, and the ones that do not fit are
 * refused with the reason they do not.
 *
 * "Fits" is arithmetic, not taste. Halve-and-double needs an even factor;
 * doubling twice needs a four; a near square needs two consecutive numbers.
 * A route that cannot be carried out on these two numbers is not a matter of
 * preference.
 */

export type StrategyId =
  | "place_value_split"
  | "halve_and_double"
  | "double_double"
  | "add_a_group"
  | "subtract_a_group"
  | "near_square"
  | "count_the_tens";

export interface Strategy {
  id: StrategyId;
  /** How the route is offered, e.g. "Split one number by place value". */
  label: string;
  /** True when this route can actually be carried out on `a × b`. */
  fits(a: number, b: number): boolean;
  /** The route worked through, for the explanation. */
  route(a: number, b: number): string;
  /** Why it does not fit, when it does not. */
  why(a: number, b: number): string;
}

const other = (a: number, b: number, driver: number): number => (a === driver ? b : a);
const has = (a: number, b: number, n: number): boolean => a === n || b === n;

export const STRATEGIES: readonly Strategy[] = Object.freeze([
  {
    id: "place_value_split",
    label: "Split one number by place value",
    // Always available above ten: every two-digit number splits into tens and ones.
    fits: (a, b) => placeValueSplit(a).length > 1 || placeValueSplit(b).length > 1,
    route: (a, b) => {
      const target = placeValueSplit(a).length > 1 ? a : b;
      const partner = other(a, b, target);
      const parts = placeValueSplit(target);
      return `${parts.map((p) => `${p} × ${partner}`).join(" and ")}, added together`;
    },
    why: () => "Both numbers are single digits, so there is nothing to split.",
  },
  {
    id: "halve_and_double",
    label: "Halve one and double the other",
    /* Worth doing only when halving an even factor lands the other on a ten —
       otherwise the rewrite makes the sum harder, not easier. */
    fits: (a, b) => (a % 2 === 0 && (b * 2) % 10 === 0) || (b % 2 === 0 && (a * 2) % 10 === 0),
    route: (a, b) => {
      const half = a % 2 === 0 && (b * 2) % 10 === 0 ? a : b;
      const partner = other(a, b, half);
      return `${half / 2} × ${partner * 2}`;
    },
    why: (a, b) =>
      a % 2 !== 0 && b % 2 !== 0
        ? "Neither number can be halved into whole groups."
        : "Doubling the other one does not land on a ten, so this makes it harder.",
  },
  {
    id: "double_double",
    label: "Double, then double again",
    fits: (a, b) => has(a, b, 4),
    route: (a, b) => {
      const partner = other(a, b, 4);
      return `2 × ${partner} = ${2 * partner}, doubled to ${4 * partner}`;
    },
    why: () => "Neither number is four, so there is nothing to reach by doubling twice.",
  },
  {
    id: "add_a_group",
    label: "Start one group below, then add a group",
    fits: (a, b) => has(a, b, 3) || has(a, b, 6),
    route: (a, b) => {
      const driver = a === 3 || a === 6 ? a : b;
      const partner = other(a, b, driver);
      const helper = driver === 3 ? 2 : 5;
      return `${helper} × ${partner} = ${helper * partner}, plus one more ${partner}`;
    },
    why: () => "Neither number sits one group above a fact worth starting from.",
  },
  {
    id: "subtract_a_group",
    label: "Start one group above, then take a group away",
    fits: (a, b) => has(a, b, 9),
    route: (a, b) => {
      const partner = other(a, b, 9);
      return `10 × ${partner} = ${10 * partner}, take one ${partner} away`;
    },
    why: () => "Neither number is nine, so there is no ten to come down from.",
  },
  {
    id: "near_square",
    label: "Use the square next to it",
    fits: (a, b) => Math.abs(a - b) === 1,
    route: (a, b) => {
      const small = Math.min(a, b);
      return `${small} × ${small} = ${small * small}, plus one more ${small}`;
    },
    why: () => "The two numbers are not next to each other, so no square is one step away.",
  },
  {
    id: "count_the_tens",
    label: "Count it in tens",
    fits: (a, b) => has(a, b, 10) || a % 10 === 0 || b % 10 === 0,
    route: (a, b) => {
      const tens = a % 10 === 0 ? a : b;
      const partner = other(a, b, tens);
      return `${tens / 10} × ${partner} tens`;
    },
    why: () => "Neither number is a whole number of tens.",
  },
]);

export const strategyById = (id: StrategyId): Strategy =>
  STRATEGIES.find((s) => s.id === id)!;

/** Every route that genuinely fits this pair. */
export const fittingStrategies = (a: number, b: number): Strategy[] =>
  STRATEGIES.filter((s) => s.fits(a, b));

/** Every route that does not — offered so a child can be wrong on purpose. */
export const unfittingStrategies = (a: number, b: number): Strategy[] =>
  STRATEGIES.filter((s) => !s.fits(a, b));
