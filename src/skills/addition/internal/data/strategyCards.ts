import { digitsOf, isBridging } from "./additionNumbers";
import { ta } from "../i18n";

/**
 * The strategies this skill has taught, and when each one is worth using.
 *
 * The last lesson asks a child to choose, so something has to know which
 * choices are *good* — and that is not the same as which ones would work.
 * Counting on works for 48 + 19 and takes nineteen counts; compensation works
 * and takes two. Both reach 67. Only one of them is worth teaching a child to
 * reach for, and `fits` is where that judgement lives.
 *
 * `work` is the same judgement made visible: the moves the strategy actually
 * takes, in order, so two of them can be laid side by side and counted. That
 * comparison is what "explain and compare strategies" means at eight years old
 * — not an essay, but noticing that one route is three steps and the other is
 * nineteen.
 */
export interface Strategy {
  id: string;
  /** As it is named in the lesson that taught it. */
  name: string;
  /** Why it suits this problem, for the feedback. */
  why(a: number, b: number): string;
  /** Whether it is a sensible route for these two numbers. */
  fits(a: number, b: number): boolean;
  /** The moves it takes, in order. Its length is the comparison. */
  work(a: number, b: number): string[];
}

const bigger = (a: number, b: number) => Math.max(a, b);
const smaller = (a: number, b: number) => Math.min(a, b);

export const STRATEGIES: Strategy[] = [
  {
    id: "count_on",
    get name() { return ta("strategy.countOn.name"); },
    why: (a, b) => ta("strategy.countOn.why", { small: smaller(a, b), big: bigger(a, b) }),
    // Always true, and deliberately so: it is the fallback that always works
    // and is almost never the best. A child comparing paths has to be able to
    // pick it and see what it costs.
    fits: () => true,
    work: (a, b) =>
      Array.from({ length: smaller(a, b) }, (_, i) =>
        ta("strategy.countOn.step", { from: bigger(a, b) + i, to: bigger(a, b) + i + 1 }),
      ),
  },
  {
    id: "doubles",
    get name() { return ta("strategy.doubles.name"); },
    why: (a) => ta("strategy.doubles.why", { a }),
    fits: (a, b) => a === b,
    work: (a, b) => [ta("strategy.doubles.step1", { a, b }), ta("strategy.doubles.step2", { a, sum: a + b })],
  },
  {
    id: "near_double",
    get name() { return ta("strategy.nearDouble.name"); },
    why: (a, b) => ta("strategy.nearDouble.why", { n: smaller(a, b) }),
    fits: (a, b) => Math.abs(a - b) === 1 && a < 20 && b < 20,
    work: (a, b) => {
      const n = smaller(a, b);
      return [ta("strategy.nearDouble.step1", { n, double: n * 2 }), ta("strategy.nearDouble.step2", { sum: a + b })];
    },
  },
  {
    id: "make_ten",
    get name() { return ta("strategy.makeTen.name"); },
    why: (a, b) => ta("strategy.makeTen.why", { big: bigger(a, b), toTen: 10 - bigger(a, b) }),
    fits: (a, b) => isBridging(a, b),
    work: (a, b) => {
      const big = bigger(a, b);
      const small = smaller(a, b);
      const toTen = 10 - big;
      return [
        ta("strategy.makeTen.step1", { big, toTen }),
        ta("strategy.makeTen.step2", { small, toTen, rest: small - toTen }),
        ta("strategy.makeTen.step3", { rest: small - toTen, sum: a + b }),
      ];
    },
  },
  {
    id: "compensate",
    get name() { return ta("strategy.compensate.name"); },
    why: (a, b) => {
      const near = a % 10 >= 8 ? a : b;
      return ta("strategy.compensate.why", { near, round: Math.ceil(near / 10) * 10 });
    },
    fits: (a, b) => (a % 10 >= 8 || b % 10 >= 8) && (a >= 10 || b >= 10),
    work: (a, b) => {
      const near = b % 10 >= 8 ? b : a;
      const other = near === b ? a : b;
      const round = Math.ceil(near / 10) * 10;
      return [
        ta("strategy.compensate.step1", { near, round }),
        ta("strategy.compensate.step2", { other, round, total: other + round }),
        ta("strategy.compensate.step3", { back: round - near, sum: a + b }),
      ];
    },
  },
  {
    id: "jump_tens_ones",
    get name() { return ta("strategy.tensOnes.name"); },
    why: (_a, b) => ta("strategy.tensOnes.why", { b, tens: digitsOf(b).tens * 10, ones: digitsOf(b).ones }),
    fits: (a, b) => a >= 10 && b >= 10 && digitsOf(b).ones > 0,
    work: (a, b) => {
      const tens = digitsOf(b).tens * 10;
      const ones = digitsOf(b).ones;
      return [
        ta("strategy.tensOnes.step1", { b, tens, ones }),
        ta("strategy.tensOnes.step2", { a, tens, total: a + tens }),
        ta("strategy.tensOnes.step3", { ones, sum: a + b }),
      ];
    },
  },
  {
    id: "start_larger",
    get name() { return ta("strategy.startLarger.name"); },
    why: (a, b) => ta("strategy.startLarger.why", { big: bigger(a, b), small: smaller(a, b) }),
    fits: (a, b) => Math.abs(a - b) >= 3 && smaller(a, b) <= 3,
    work: (a, b) => [
      ta("strategy.startLarger.step1", { big: bigger(a, b) }),
      ta("strategy.startLarger.step2", { small: smaller(a, b), big: bigger(a, b) }),
      ta("strategy.startLarger.step3", { sum: a + b }),
    ],
  },
];

export const byId = (id: string): Strategy => STRATEGIES.find((s) => s.id === id)!;

/**
 * The strategies worth using on these two numbers.
 *
 * Always at least one, because counting on always fits — which is the point of
 * having it in the list. A problem where nothing clever applies is still a
 * problem a child can do.
 */
export const fittingFor = (a: number, b: number): Strategy[] =>
  STRATEGIES.filter((s) => s.fits(a, b));
