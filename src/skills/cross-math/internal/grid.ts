/**
 * Cross Math: a grid of equations that share their numbers.
 *
 * Two shapes:
 *
 * - **Small (size 2), closed.** Two operands per line, a 3×3 block of numbers.
 *   Every row and every column is an equation, including the bottom row and the
 *   right column, which meet in one shared corner.
 *
 *       3 + 2 = 5
 *       +   +   +
 *       1 + 5 = 6
 *       =   =   =
 *       4 + 7 = 11
 *
 * - **Big (size 3), open.** Three operands per line. Three rows and three
 *   columns are equations; the results sit along the right and the bottom, and
 *   there is no corner.
 *
 * Everything here is pure and seeded: the same spec and seed always give the
 * same puzzle, which keeps StrictMode's double render, a test and a resumed
 * round in agreement about what was asked.
 */

export type Op = "+" | "-" | "*" | "/";
export const ALL_OPS: readonly Op[] = ["+", "-", "*", "/"];
/** What a child sees. The data uses ASCII so lessons.json stays typeable. */
export const OP_SYMBOL: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export interface CrossSpec {
  /** Operands per line: 2 is the small closed grid, 3 the big open one. */
  size?: 2 | 3;
  /** Signs the puzzle may use. */
  ops?: Op[];
  /** The largest number anywhere on the board, results included. */
  max?: number;
  /** How many numbers are hidden for the child to place. */
  blanks?: number;
  /** How many signs are hidden for the child to choose. */
  signs?: number;
  /** For × and ÷: one factor, or the divisor, comes from this set. */
  factors?: number[];
  /** Signs that must appear at least once. */
  mustUse?: Op[];
  /** Whether a result may be 0. */
  allowZero?: boolean;
}

export type Slot =
  | { kind: "num"; r: number; c: number }
  | { kind: "op"; line: "row" | "col"; index: number; k: number };

export interface Puzzle {
  size: 2 | 3;
  closed: boolean;
  /** (size+1)² numbers. Row `size` and column `size` hold results; the open grid's corner is null. */
  nums: (number | null)[][];
  /** Signs per row equation, `size - 1` each. */
  rowOps: Op[][];
  /** Signs per column equation. */
  colOps: Op[][];
  /** What the child fills, in reading order (top to bottom, left to right). */
  slots: Slot[];
  /** The answer for each slot, as shown on a tile. */
  answers: string[];
  /** Number tiles, one per hidden number, in a seeded shuffle. */
  bank: number[];
  /** Sign choices, shown when any sign is hidden. Never used up. */
  palette: Op[];
}

export interface Line {
  kind: "row" | "col";
  index: number;
}

/* ---------- randomness ---------- */

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const between = (rand: () => number, lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
function shuffle<T>(rand: () => number, items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------- evaluating a line ---------- */

/**
 * The value of a line as written, with × and ÷ first.
 *
 * This is the truth a line is judged by. It never trusts the generator: an
 * answer a child finds that the generator did not intend is still right if
 * this says every line holds.
 */
export function evaluate(values: number[], ops: Op[]): number {
  // Fold × and ÷ into terms, then add and subtract the terms.
  const terms: number[] = [values[0]];
  const joins: Op[] = [];
  for (let i = 0; i < ops.length; i += 1) {
    const v = values[i + 1];
    if (ops[i] === "*") terms[terms.length - 1] *= v;
    else if (ops[i] === "/") terms[terms.length - 1] = v === 0 ? NaN : terms[terms.length - 1] / v;
    else {
      terms.push(v);
      joins.push(ops[i]);
    }
  }
  return terms.reduce((acc, t, i) => (i === 0 ? t : joins[i - 1] === "+" ? acc + t : acc - t), 0);
}

export const holds = (values: number[], ops: Op[], result: number): boolean =>
  Math.abs(evaluate(values, ops) - result) < 1e-9;

export const lines = (p: Pick<Puzzle, "size" | "closed">): Line[] => {
  const n = p.closed ? p.size + 1 : p.size;
  return [
    ...Array.from({ length: n }, (_, index) => ({ kind: "row" as const, index })),
    ...Array.from({ length: n }, (_, index) => ({ kind: "col" as const, index })),
  ];
};

/** The number cells of a line, operands first, the result last. */
export function lineCells(p: Pick<Puzzle, "size">, line: Line): [number, number][] {
  return Array.from({ length: p.size + 1 }, (_, i) =>
    line.kind === "row" ? [line.index, i] as [number, number] : [i, line.index] as [number, number]);
}

/* ---------- generating ---------- */

interface Normal {
  size: 2 | 3;
  ops: Op[];
  max: number;
  blanks: number;
  signs: number;
  factors?: number[];
  mustUse: Op[];
  allowZero: boolean;
}

export function normalise(spec: CrossSpec = {}): Normal {
  const ops = (spec.ops?.length ? spec.ops : ["+"]).filter((o): o is Op => ALL_OPS.includes(o as Op));
  return {
    size: spec.size === 3 ? 3 : 2,
    ops: ops.length ? ops : ["+"],
    max: Math.max(5, spec.max ?? 10),
    blanks: Math.max(0, spec.blanks ?? 2),
    signs: Math.max(0, spec.signs ?? 0),
    factors: spec.factors?.length ? spec.factors : undefined,
    mustUse: spec.mustUse ?? [],
    allowZero: Boolean(spec.allowZero),
  };
}

/**
 * Whether a line works the way a child would work it: left to right, staying
 * whole and never below zero — and whether that agrees with the order of
 * operations. A line where the two disagree would teach something false to a
 * child who reads left to right, so it is never generated.
 */
function lineValue(values: number[], ops: Op[], s: Normal): number | null {
  const pair = values.length === 2;
  let acc = values[0];
  for (let i = 0; i < ops.length; i += 1) {
    const b = values[i + 1];
    switch (ops[i]) {
      case "+":
        acc += b;
        break;
      case "-":
        acc -= b;
        if (acc < 0) return null;
        break;
      case "*":
        if (b < 2 || b > 10) return null;
        if (pair && (acc < 2 || acc > 10)) return null;
        if (s.factors && !s.factors.includes(b) && !s.factors.includes(acc)) return null;
        acc *= b;
        break;
      case "/":
        if (b < 2 || b > 10 || acc % b !== 0) return null;
        if (s.factors && !s.factors.includes(b)) return null;
        acc /= b;
        if (pair && acc > 10) return null;
        break;
    }
    if (acc > s.max) return null;
  }
  if (acc < (s.allowZero ? 0 : 1)) return null;
  return evaluate(values, ops) === acc ? acc : null;
}

const someOps = (rand: () => number, s: Normal): Op[] =>
  Array.from({ length: s.size - 1 }, () => pick(rand, s.ops));

/** A number for an operand: mostly small, sometimes up to the board's max. */
function operand(rand: () => number, s: Normal): number {
  const timesy = s.ops.includes("*") || s.ops.includes("/");
  if (timesy) return rand() < 0.65 ? between(rand, 1, 10) : between(rand, 1, s.max);
  const cap = Math.max(3, Math.floor(s.max / (s.size === 3 ? 2 : 2)));
  return between(rand, 1, cap);
}

interface Solved {
  nums: (number | null)[][];
  rowOps: Op[][];
  colOps: Op[][];
}

function solveBoard(rand: () => number, s: Normal): Solved | null {
  const n = s.size;
  const closed = n === 2;
  const nums: (number | null)[][] = Array.from({ length: n + 1 }, () => Array<number | null>(n + 1).fill(null));
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) nums[r][c] = operand(rand, s);

  const rowOps: Op[][] = [];
  const colOps: Op[][] = [];
  for (let i = 0; i < n; i += 1) {
    rowOps.push(someOps(rand, s));
    colOps.push(someOps(rand, s));
  }
  for (let r = 0; r < n; r += 1) {
    const v = lineValue(nums[r].slice(0, n) as number[], rowOps[r], s);
    if (v === null) return null;
    nums[r][n] = v;
  }
  for (let c = 0; c < n; c += 1) {
    const v = lineValue(nums.slice(0, n).map((row) => row[c] as number), colOps[c], s);
    if (v === null) return null;
    nums[n][c] = v;
  }
  if (closed) {
    // The corner is reached two ways; keep a pair of signs that agree.
    const bottom = nums[n].slice(0, n) as number[];
    const right = nums.slice(0, n).map((row) => row[n] as number);
    const pairs: [Op, Op, number][] = [];
    for (const a of s.ops) {
      for (const b of s.ops) {
        const x = lineValue(bottom, [a], s);
        const y = lineValue(right, [b], s);
        if (x !== null && x === y) pairs.push([a, b, x]);
      }
    }
    if (!pairs.length) return null;
    const [a, b, corner] = pick(rand, pairs);
    rowOps.push([a]);
    colOps.push([b]);
    nums[n][n] = corner;
  }
  const used = new Set([...rowOps.flat(), ...colOps.flat()]);
  if (!s.mustUse.every((o) => used.has(o))) return null;
  const operands = nums.slice(0, n).flatMap((row) => row.slice(0, n));
  if (operands.every((v) => v === operands[0])) return null;
  return { nums, rowOps, colOps };
}

const slotKey = (slot: Slot): string =>
  slot.kind === "num" ? `n${slot.r}${slot.c}` : `o${slot.line}${slot.index}${slot.k}`;

/** Reading order: by display row, then display column. */
function displayPos(slot: Slot): [number, number] {
  if (slot.kind === "num") return [slot.r * 2, slot.c * 2];
  return slot.line === "row" ? [slot.index * 2, slot.k * 2 + 1] : [slot.k * 2 + 1, slot.index * 2];
}
const byReading = (a: Slot, b: Slot): number => {
  const [ar, ac] = displayPos(a);
  const [br, bc] = displayPos(b);
  return ar - br || ac - bc;
};

export function valueAt(board: Solved, slot: Slot): string {
  if (slot.kind === "num") return String(board.nums[slot.r][slot.c]);
  return (slot.line === "row" ? board.rowOps : board.colOps)[slot.index][slot.k];
}

/**
 * Builds a puzzle that has exactly one way to fill it.
 *
 * Random search is bounded. If a lesson's spec cannot be met it falls back to
 * an easier one rather than hang or crash a child's round; the lesson tests
 * hold every shipped spec to producing its own puzzles.
 */
export function generatePuzzle(spec: CrossSpec, seed: string): Puzzle {
  const s = normalise(spec);
  const rand = seededRandom(seed);
  for (let attempt = 0; attempt < 30000; attempt += 1) {
    const board = solveBoard(rand, s);
    if (!board) continue;
    const puzzle = hide(rand, s, board);
    if (puzzle) return puzzle;
  }
  if (s.mustUse.length || s.factors) return generatePuzzle({ ...spec, mustUse: [], factors: undefined }, `${seed}+`);
  return generatePuzzle({ size: 2, ops: ["+"], max: 10, blanks: 2 }, `${seed}+`);
}

/** Exported so a test can ask whether a given puzzle has `generatePuzzle`'s
 *  slot picking. Not for the activity. */
export const SPEC_NORMAL = normalise;

function hide(rand: () => number, s: Normal, board: Solved): Puzzle | null {
  const n = s.size;
  const closed = n === 2;
  const numberCells: Slot[] = [];
  for (let r = 0; r <= n; r += 1) {
    for (let c = 0; c <= n; c += 1) if (board.nums[r][c] !== null) numberCells.push({ kind: "num", r, c });
  }
  const opCells: Slot[] = [];
  const count = closed ? n + 1 : n;
  for (let i = 0; i < count; i += 1) {
    for (let k = 0; k < n - 1; k += 1) {
      opCells.push({ kind: "op", line: "row", index: i, k });
      opCells.push({ kind: "op", line: "col", index: i, k });
    }
  }
  if (s.blanks > numberCells.length || s.signs > opCells.length) return null;

  for (let tries = 0; tries < 12; tries += 1) {
    const slots = [
      ...shuffle(rand, numberCells).slice(0, s.blanks),
      ...shuffle(rand, opCells).slice(0, s.signs),
    ].sort(byReading);
    const answers = slots.map((slot) => valueAt(board, slot));
    const bank = shuffle(rand, slots.filter((x) => x.kind === "num").map((x) => Number(valueAt(board, x))));
    const puzzle: Puzzle = {
      size: n,
      closed,
      nums: board.nums,
      rowOps: board.rowOps,
      colOps: board.colOps,
      slots,
      answers,
      bank,
      palette: s.signs ? s.ops.slice() : [],
    };
    if (countSolutions(puzzle, 2) === 1) return puzzle;
  }
  return null;
}

/* ---------- solving ---------- */

/** The board with the child's (or a solver's) values in the slots. */
export function fill(p: Puzzle, values: (string | null)[]): Solved {
  const nums = p.nums.map((row) => row.slice());
  const rowOps = p.rowOps.map((ops) => ops.slice());
  const colOps = p.colOps.map((ops) => ops.slice());
  p.slots.forEach((slot, i) => {
    const v = values[i];
    if (slot.kind === "num") nums[slot.r][slot.c] = v === null ? null : Number(v);
    else (slot.line === "row" ? rowOps : colOps)[slot.index][slot.k] = (v ?? "?") as Op;
  });
  return { nums, rowOps, colOps };
}

/** Whether one line is complete and true. Null while it still has a gap. */
export function lineHolds(p: Pick<Puzzle, "size">, board: Solved, line: Line): boolean | null {
  const cells = lineCells(p, line).map(([r, c]) => board.nums[r][c]);
  const ops = (line.kind === "row" ? board.rowOps : board.colOps)[line.index];
  if (cells.some((v) => v === null) || ops.some((o) => !ALL_OPS.includes(o))) return null;
  const values = cells as number[];
  return holds(values.slice(0, -1), ops, values[values.length - 1]);
}

/** Whether every line holds. Judged from the board, never from the answer key. */
export function isSolved(p: Puzzle, values: (string | null)[]): boolean {
  const board = fill(p, values);
  return lines(p).every((line) => lineHolds(p, board, line) === true);
}

/** The lines a slot belongs to. */
export function linesOf(p: Puzzle, slot: Slot): Line[] {
  const all = lines(p);
  if (slot.kind === "op") return [{ kind: slot.line, index: slot.index }];
  return all.filter((line) => (line.kind === "row" ? line.index === slot.r : line.index === slot.c));
}

/**
 * How many ways there are to fill the puzzle from its tiles, stopping at
 * `limit`. A puzzle ships only when this is exactly one.
 */
export function countSolutions(p: Puzzle, limit = 2): number {
  const values: (string | null)[] = p.slots.map(() => null);
  const left = new Map<number, number>();
  for (const v of p.bank) left.set(v, (left.get(v) ?? 0) + 1);
  const touching = p.slots.map((slot) => linesOf(p, slot));
  let found = 0;

  const step = (i: number): void => {
    if (found >= limit) return;
    if (i === p.slots.length) {
      found += 1;
      return;
    }
    const slot = p.slots[i];
    const choices = slot.kind === "num"
      ? [...left.keys()].filter((k) => (left.get(k) ?? 0) > 0).map(String)
      : p.palette;
    for (const choice of choices) {
      values[i] = choice;
      if (slot.kind === "num") left.set(Number(choice), (left.get(Number(choice)) ?? 0) - 1);
      const board = fill(p, values);
      if (touching[i].every((line) => lineHolds(p, board, line) !== false)) step(i + 1);
      if (slot.kind === "num") left.set(Number(choice), (left.get(Number(choice)) ?? 0) + 1);
      values[i] = null;
      if (found >= limit) return;
    }
  };
  step(0);
  return found;
}

export const slotId = slotKey;
