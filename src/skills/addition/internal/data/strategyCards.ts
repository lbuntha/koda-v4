import { digitsOf, isBridging } from "./additionNumbers";

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
    name: "Count on",
    why: (a, b) => `You can always count on — here it means ${smaller(a, b)} counts from ${bigger(a, b)}.`,
    // Always true, and deliberately so: it is the fallback that always works
    // and is almost never the best. A child comparing paths has to be able to
    // pick it and see what it costs.
    fits: () => true,
    work: (a, b) =>
      Array.from({ length: smaller(a, b) }, (_, i) => `${bigger(a, b) + i} → ${bigger(a, b) + i + 1}`),
  },
  {
    id: "doubles",
    name: "Use a double",
    why: (a) => `${a} and ${a} is a double, and doubles are worth knowing by heart.`,
    fits: (a, b) => a === b,
    work: (a, b) => [`${a} and ${b} is a double`, `double ${a} is ${a + b}`],
  },
  {
    id: "near_double",
    name: "Use a near double",
    why: (a, b) => `${smaller(a, b)} and ${smaller(a, b)} is a double you know, and this is one more.`,
    fits: (a, b) => Math.abs(a - b) === 1 && a < 20 && b < 20,
    work: (a, b) => {
      const n = smaller(a, b);
      return [`${n} and ${n} is ${n * 2}`, `one more is ${a + b}`];
    },
  },
  {
    id: "make_ten",
    name: "Make ten first",
    why: (a, b) => `${bigger(a, b)} only needs ${10 - bigger(a, b)} to reach ten, and ten is easy to add to.`,
    fits: (a, b) => isBridging(a, b),
    work: (a, b) => {
      const big = bigger(a, b);
      const small = smaller(a, b);
      const toTen = 10 - big;
      return [
        `${big} needs ${toTen} to reach ten`,
        `${small} splits into ${toTen} and ${small - toTen}`,
        `ten and ${small - toTen} is ${a + b}`,
      ];
    },
  },
  {
    id: "compensate",
    name: "Round and give back",
    why: (a, b) => {
      const near = a % 10 >= 8 ? a : b;
      return `${near} is nearly ${Math.ceil(near / 10) * 10}, which is a much easier number to add.`;
    },
    fits: (a, b) => (a % 10 >= 8 || b % 10 >= 8) && (a >= 10 || b >= 10),
    work: (a, b) => {
      const near = b % 10 >= 8 ? b : a;
      const other = near === b ? a : b;
      const round = Math.ceil(near / 10) * 10;
      return [
        `${near} is nearly ${round}`,
        `${other} and ${round} is ${other + round}`,
        `give back ${round - near} → ${a + b}`,
      ];
    },
  },
  {
    id: "jump_tens_ones",
    name: "Tens, then ones",
    why: (a, b) => `${b} splits into ${digitsOf(b).tens * 10} and ${digitsOf(b).ones}, and tens are an easy jump.`,
    fits: (a, b) => a >= 10 && b >= 10 && digitsOf(b).ones > 0,
    work: (a, b) => {
      const tens = digitsOf(b).tens * 10;
      const ones = digitsOf(b).ones;
      return [`${b} is ${tens} and ${ones}`, `${a} and ${tens} is ${a + tens}`, `and ${ones} more is ${a + b}`];
    },
  },
  {
    id: "start_larger",
    name: "Start with the bigger one",
    why: (a, b) => `Starting at ${bigger(a, b)} leaves only ${smaller(a, b)} to count instead of ${bigger(a, b)}.`,
    fits: (a, b) => Math.abs(a - b) >= 3 && smaller(a, b) <= 3,
    work: (a, b) => [
      `${bigger(a, b)} is the bigger number`,
      `count on ${smaller(a, b)} from ${bigger(a, b)}`,
      `that is ${a + b}`,
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
