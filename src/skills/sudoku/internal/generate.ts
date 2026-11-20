import { remix, seededRandom, shuffle, solvedGrid, type Size } from "./board";
import {
  PLACES,
  TECHNIQUES,
  apply,
  find,
  findsWith,
  nextStep,
  rank,
  solveLogically,
  stateOf,
  upTo,
  type Move,
  type State,
  type Step,
  type Technique,
} from "./techniques";

/**
 * Puzzles made to order.
 *
 * A lesson names a technique; a puzzle for it is one a person can finish with
 * that technique and the easier ones, and cannot finish without it. Because
 * every step of a logical solve is forced, such a puzzle has exactly one answer
 * — no separate uniqueness search is needed.
 */
export interface PuzzleSpec {
  size: Size;
  /** The technique the puzzle must need. */
  technique: Technique;
  /** How many cells to empty. Left out: as many as the technique allows. */
  blanks?: number;
}

export interface Puzzle {
  n: Size;
  givens: number[];
  answer: number[];
  technique: Technique;
}

const ATTEMPTS = 60;

/**
 * Empty cells one at a time, keeping each removal only while the board can
 * still be finished with `allowed`. Stops at `blanks`, or when nothing more
 * can go.
 */
function dig(answer: number[], n: Size, allowed: readonly Technique[], blanks: number, rand: () => number): number[] {
  const grid = answer.slice();
  let removed = 0;
  for (const i of shuffle([...grid.keys()], rand)) {
    if (removed >= blanks) break;
    const keep = grid[i];
    grid[i] = 0;
    if (solveLogically(grid, n, allowed).solved) removed += 1;
    else grid[i] = keep;
  }
  return grid;
}

/**
 * The best puzzle within `ATTEMPTS`: one that needs the technique if any did,
 * else the hardest seen. Seeded, so the same spec and seed always give the
 * same puzzle.
 */
export function makePuzzle(spec: PuzzleSpec, seed: string): Puzzle {
  const rand = seededRandom(seed);
  const n = spec.size;
  const allowed = upTo(spec.technique);
  const blanks = spec.blanks ?? n * n;
  let best: Puzzle | undefined;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const answer = solvedGrid(n, rand);
    const givens = dig(answer, n, allowed, blanks, rand);
    const rating = solveLogically(givens, n, allowed).hardest ?? "full-house";
    const puzzle: Puzzle = { n, givens, answer, technique: rating };
    if (rating === spec.technique) return puzzle;
    if (!best || rank(rating) > rank(best.technique)) best = puzzle;
  }
  return best!;
}

/* ---------- the stock of hard puzzles ---------- */

/**
 * Puzzles that need Pointing or harder turn up rarely when digging at random —
 * one X-Wing in a few hundred tries — which is far too slow to do while a child
 * waits. Those come from a stock made ahead of time (`scripts/generate-sudoku-bank.ts`)
 * and are remixed on the way out: rows, columns and digits shuffled, which
 * makes a new-looking puzzle that needs exactly the same techniques.
 */
export type Bank = Partial<Record<Technique, string[]>>;

export const LIVE_LIMIT: Technique = "pointing";

export const needsBank = (spec: PuzzleSpec): boolean =>
  spec.size === 9 && rank(spec.technique) > rank(LIVE_LIMIT);

export const encode = (cells: number[]): string => cells.join("");
export const decode = (text: string): number[] => [...text].map(Number);

export function fromBank(bank: Bank, spec: PuzzleSpec, seed: string): Puzzle | undefined {
  const stock = bank[spec.technique];
  if (!stock?.length) return undefined;
  const rand = seededRandom(seed);
  const pick = decode(stock[Math.floor(rand() * stock.length)]);
  const solved = solveLogically(pick, 9);
  if (!solved.solved) return undefined;
  // One remix applied to both, so the answer still matches the givens.
  const order = seededRandom(`${seed}:remix`);
  const givens = remix(pick, 9, order);
  const answer = remix(solved.grid, 9, seededRandom(`${seed}:remix`));
  return { n: 9, givens, answer, technique: spec.technique };
}

/* ---------- drills ---------- */

/**
 * A board stopped at the moment a technique is needed, for practising finding
 * it fast. Everything easier has already been used up, so the next placement
 * the child can make needs exactly this technique.
 */
export interface Drill {
  n: Size;
  /** Numbers on the board at that moment: the givens and what was placed since. */
  grid: number[];
  /** Notes at that moment. Shown from Pointing on, where the notes are the point. */
  cand: number[];
  answer: number[];
  technique: Technique;
  /** One instance of the technique, for the hints. */
  step: Step;
  /** Every placement that counts as finding it. */
  finds: Move[];
  /** Set when the drill asks for one number: "Where does 7 go?". */
  digit?: number;
}

/** Walk a puzzle's solve up to the first time `t` is the easiest step. */
export function drillFrom(p: Puzzle, t: Technique): Drill | undefined {
  const s: State = stateOf(p.givens, p.n);
  const allowed = upTo(t);
  for (let guard = 0; guard < 500; guard += 1) {
    const step = nextStep(s, allowed);
    if (!step) return undefined;
    if (step.technique === t) {
      const finds = findsWith(s, t).filter((m) => p.answer[m.cell] === m.value);
      if (!finds.length) return undefined;
      // Naked singles are found by cell; the rest are found by number.
      const digit = t === "naked-single" || t === "full-house" ? undefined : PLACES.has(t) ? step.placements[0].value : firstFind(s, step, finds);
      const accepted = digit ? finds.filter((m) => m.value === digit) : finds;
      if (!accepted.length) return undefined;
      return { n: p.n, grid: s.grid.slice(), cand: s.cand.slice(), answer: p.answer, technique: t, step, finds: accepted, digit };
    }
    apply(s, step);
  }
  return undefined;
}

/** For a note-removing step: the number that the step lets you place. */
function firstFind(s: State, step: Step, finds: Move[]): number | undefined {
  const work: State = { n: s.n, grid: s.grid.slice(), cand: s.cand.slice() };
  apply(work, step);
  const opened = TECHNIQUES.filter((x) => PLACES.has(x)).flatMap((x) => find(work, x)).flatMap((x) => x.placements);
  const hit = opened.find((m) => finds.some((f) => f.cell === m.cell && f.value === m.value));
  return (hit ?? finds[0]).value;
}

export function makeDrill(spec: PuzzleSpec, seed: string, bank: Bank = {}): Drill {
  for (let k = 0; k < 30; k += 1) {
    const s = `${seed}:${k}`;
    const p = (needsBank(spec) && fromBank(bank, spec, s)) || makePuzzle(spec, s);
    const drill = drillFrom(p, spec.technique);
    if (drill) return drill;
  }
  // Nothing in thirty tries: a full-house drill always exists.
  const p = makePuzzle({ size: spec.size, technique: "full-house" }, seed);
  return drillFrom(p, "full-house") ?? drillFrom(makePuzzle({ size: spec.size, technique: "full-house", blanks: 1 }, seed), "full-house")!;
}

export function makeGame(spec: PuzzleSpec, seed: string, bank: Bank = {}): Puzzle {
  return (needsBank(spec) && fromBank(bank, spec, seed)) || makePuzzle(spec, seed);
}
