/**
 * Questions for BalanceBeam: which is heavier on a pan balance, and how many
 * cubes balance a thing.
 *
 * Pure. Masses are whole grams (or whole cubes), and how big a thing is drawn
 * is a separate number from how heavy it is, because "big means heavy" is the
 * mistake the first lesson is there to break.
 */

export type BalanceMode = "compare" | "cubes";
export const BALANCE_MODES: readonly BalanceMode[] = ["compare", "cubes"];

export type MassThing = "feather" | "balloon" | "pillow" | "brick" | "rock" | "apple" | "watermelon" | "book" | "shoe";

/** Real-world mass in grams, and drawn size from 1 (small) to 10 (big). */
export const MASS_THINGS: Record<MassThing, { grams: number; size: number }> = {
  feather: { grams: 5, size: 5 },
  balloon: { grams: 10, size: 10 },
  pillow: { grams: 500, size: 10 },
  apple: { grams: 150, size: 4 },
  shoe: { grams: 400, size: 6 },
  book: { grams: 600, size: 6 },
  rock: { grams: 2000, size: 4 },
  brick: { grams: 2500, size: 5 },
  watermelon: { grams: 4000, size: 9 },
};
export const MASS_LIST = Object.keys(MASS_THINGS) as MassThing[];

/** Two things this many times apart in mass, so the beam's tip is unmistakable. */
export const MIN_RATIO = 3;

/** Things a few cubes can balance in the cubes lesson. Their cube count is drawn per question. */
export const CUBE_THINGS: MassThing[] = ["apple", "shoe", "book", "pillow"];

export interface BalanceQuestion {
  mode: BalanceMode;
  /** compare: left and right things; cubes: the thing on the left pan. */
  left: MassThing;
  right?: MassThing;
  ask: "heavier" | "lighter";
  /** compare: "left" | "right"; cubes: the number of cubes, as a string. */
  answer: string;
  /** cubes: how many cubes the thing weighs. */
  cubes?: number;
}

export interface BalanceSetup {
  mode?: BalanceMode;
  minCubes?: number;
  maxCubes?: number;
  questionsPerRound?: number;
  practice?: boolean;
  modes?: BalanceMode[];
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** Pairs far enough apart in mass, each listed once (left lighter or heavier is drawn later). */
export const FAIR_PAIRS: [MassThing, MassThing][] = MASS_LIST.flatMap((a, i) =>
  MASS_LIST.slice(i + 1)
    .filter((b) => Math.max(MASS_THINGS[a].grams, MASS_THINGS[b].grams) / Math.min(MASS_THINGS[a].grams, MASS_THINGS[b].grams) >= MIN_RATIO)
    .map((b) => [a, b] as [MassThing, MassThing]),
);

/** Pairs where the bigger drawing is the lighter thing: the ones that teach. */
export const TRICK_PAIRS = FAIR_PAIRS.filter(([a, b]) => {
  const [ga, gb] = [MASS_THINGS[a].grams, MASS_THINGS[b].grams];
  const [sa, sb] = [MASS_THINGS[a].size, MASS_THINGS[b].size];
  return (ga > gb && sa < sb) || (gb > ga && sb < sa);
});

const keyOf = (q: BalanceQuestion) => `${q.mode}:${q.left}:${q.right ?? q.cubes}:${q.ask}`;

export function buildBalance(setup: BalanceSetup, mode: BalanceMode, seen: Set<string>, rand: () => number = Math.random): BalanceQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(setup, mode, rand);
  seen.add(keyOf(q));
  return q;
}

function draw(setup: BalanceSetup, mode: BalanceMode, rand: () => number): BalanceQuestion {
  if (mode === "cubes") {
    const lo = setup.minCubes ?? 2;
    const hi = setup.maxCubes ?? 9;
    const cubes = randInt(lo, hi, rand);
    return { mode, left: pick(CUBE_THINGS, rand), ask: "heavier", answer: String(cubes), cubes };
  }
  // Half the time a pair where looks mislead, so size alone is a losing strategy.
  const pool = rand() < 0.5 && TRICK_PAIRS.length ? TRICK_PAIRS : FAIR_PAIRS;
  const [x, y] = pick(pool, rand);
  const [left, right] = rand() < 0.5 ? [x, y] : [y, x];
  const ask = rand() < 0.5 ? "heavier" : "lighter";
  const leftHeavier = MASS_THINGS[left].grams > MASS_THINGS[right].grams;
  const answer = (ask === "heavier") === leftHeavier ? "left" : "right";
  return { mode, left, right, ask, answer };
}

/** Degrees the beam tips, positive = right side down. Clamped so it never looks broken. */
export const MAX_TILT = 14;
export function tilt(leftMass: number, rightMass: number, perUnit = 3): number {
  const raw = (rightMass - leftMass) * perUnit;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
}

/** compare mode tips fully: any fair pair is a clear win. */
export const compareTilt = (q: BalanceQuestion): number =>
  MASS_THINGS[q.right!].grams > MASS_THINGS[q.left].grams ? MAX_TILT : -MAX_TILT;

export function balanceModeAt(setup: BalanceSetup, index: number): BalanceMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "compare"];
  return cycle[(index - 1) % cycle.length];
}
