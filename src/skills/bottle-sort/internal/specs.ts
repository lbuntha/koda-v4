import type { RackSpec } from "./types";

/**
 * Generation parameters for every lesson in the plan's lesson map.
 *
 * Kept beside the generator rather than only in `lessons.json` so Phase 0 can
 * prove the invariants across all 33 before any lesson, engine or UI exists.
 * Phase 1's lessons.json passes these same fields through `params.question`.
 */
export const RACK_SPECS: RackSpec[] = [
  { id: "one-pour", mode: "plain", colours: 2, bottles: 3, cap: 4, scramble: 1 },
  { id: "two-pours", mode: "plain", colours: 2, bottles: 4, cap: 4, scramble: 2 },
  { id: "use-the-empty-bottle", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 6 },
  { id: "pour-the-whole-run", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 5 },
  { id: "sort-three-colours", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 7 },
  { id: "short-and-tall", mode: "capacity", colours: 3, bottles: 5, cap: 4, caps: [3, 5, 4, 3, 5], scramble: 8 },
  { id: "will-it-fit", mode: "capacity", colours: 3, bottles: 5, cap: 4, caps: [4, 3, 5, 4, 3], scramble: 8 },
  { id: "fill-to-the-top", mode: "capacity", colours: 3, bottles: 5, cap: 4, caps: [5, 3, 4, 5, 3], scramble: 9 },
  { id: "count-before-you-pour", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 8 },
  { id: "practice-pouring", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 8 },

  { id: "four-colours", mode: "plain", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "taller-bottles", mode: "plain", colours: 4, bottles: 6, cap: 5, scramble: 11 },
  { id: "one-space-left", mode: "plain", colours: 4, bottles: 5, cap: 4, scramble: 10 },
  { id: "no-free-bottle", mode: "plain", colours: 4, bottles: 5, cap: 4, scramble: 11 },
  { id: "the-locked-bottle", mode: "locked", colours: 3, bottles: 5, cap: 4, scramble: 8, lock: { tube: 4, on: 0 } },
  { id: "two-locks", mode: "locked", colours: 4, bottles: 6, cap: 4, scramble: 10, lock: { tube: 5, on: 0 } },
  { id: "the-one-way-bottle", mode: "oneway", colours: 3, bottles: 5, cap: 4, scramble: 8, oneWay: 3 },
  { id: "think-before-you-pour", mode: "budget", colours: 4, bottles: 6, cap: 4, scramble: 10, budget: "minimum+2" },
  { id: "the-shortest-way", mode: "budget", colours: 3, bottles: 5, cap: 4, scramble: 7, budget: "minimum" },
  { id: "practice-planning", mode: "plain", colours: 4, bottles: 6, cap: 4, scramble: 10 },

  { id: "what-is-underneath", mode: "hidden", colours: 3, bottles: 5, cap: 4, scramble: 9, hidden: true },
  { id: "reveal-as-you-go", mode: "hidden", colours: 4, bottles: 6, cap: 4, scramble: 10, hidden: true },
  { id: "guess-the-result", mode: "plain", colours: 3, bottles: 4, cap: 4, scramble: 4 },
  { id: "guess-two-ahead", mode: "plain", colours: 3, bottles: 5, cap: 4, scramble: 6 },
  { id: "sort-by-number", mode: "numbered", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "sort-backwards", mode: "numbered", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "odd-and-even-bottles", mode: "numbered", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "sort-by-size", mode: "fractions", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "count-by-twos", mode: "numbered", colours: 4, bottles: 6, cap: 4, scramble: 10 },
  { id: "make-the-rainbow", mode: "pattern", colours: 4, bottles: 6, cap: 4, scramble: 11 },
  // "linked-bottles" is held back: see the note in pour.ts. It needs a rule
  // that conserves liquid before a rack for it can be generated.
  { id: "mixed-racks", mode: "plain", colours: 6, bottles: 8, cap: 5, scramble: 16 },
  { id: "practice-bottle-sort", mode: "plain", colours: 5, bottles: 7, cap: 4, scramble: 13 },
];

export const specFor = (id: string): RackSpec | undefined => RACK_SPECS.find((s) => s.id === id);
