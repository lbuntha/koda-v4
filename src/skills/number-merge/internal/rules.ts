/**
 * Number Merge: the rules, with no React in sight.
 *
 * A board is a square of tiles. A child moves one tile onto a tile next to it
 * (up, down, left or right) and the two merge. What a merge does depends on the
 * mode:
 *
 * - `bond`        two tiles that add to the target pop. Any other pair is a wrong answer.
 * - `difference`  two tiles that are the target apart pop. Any other pair is a wrong answer.
 * - `sum`         tiles add up; exactly the target pops, going over is refused.
 * - `product`     tiles multiply; exactly the target pops, a product that is not a
 *                 factor of the target is refused.
 * - `bundle`      ones merge into a ten, tens merge into a hundred; never over.
 * - `fraction`    parts of one whole add up; exactly one whole pops.
 * - `doubleFact`  two equal tiles pop as their double (3 and 3 make 6). Any other pair is a wrong answer.
 * - `double`      two equal tiles merge into their double, again and again; the target pops.
 *
 * Gaps fill by gravity: tiles fall, new tiles arrive at the top. Every board this
 * file hands out has a move on it, so a child is never stuck with nothing to do.
 */

export type Mode = "bond" | "difference" | "sum" | "product" | "bundle" | "fraction" | "doubleFact" | "double";

export interface MergeSetup {
  mode?: Mode;
  /** What a pop makes: the bond total, the gap, the sum, the product, 10 or 100, or the denominator. */
  target?: number;
  /** Board side, 3 to 5. */
  size?: number;
  /** Largest number on a new tile (bond, difference, sum). */
  max?: number;
  /**
   * How a tile shows its number: the numeral, a picture of it (dots in a
   * ten-frame for small numbers, rods for tens, a pie for fractions), or both.
   * Fractions always draw their pie.
   */
  show?: "number" | "dots" | "both";
  /** Fraction mode: the numerators (over `target`) a new tile can have. */
  parts?: number[];
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
}

export interface Tile {
  /** Stable across moves, so a tile can be animated from where it was to where it is. */
  id: number;
  v: number;
}

export type Cell = Tile | null;

export interface Board {
  size: number;
  cells: Cell[];
  /** Next tile id. */
  next: number;
}

export type Refusal = "notBond" | "notDifference" | "notSame" | "over" | "notFactor" | "overTen" | "overHundred" | "mixed";

export type Verdict =
  | { kind: "pop"; value: number }
  | { kind: "grow"; value: number }
  | { kind: "refuse"; reason: Refusal; value: number };

export const MODE_DEFAULTS: Record<Mode, Required<Pick<MergeSetup, "target" | "size">> & MergeSetup> = {
  bond: { target: 10, size: 4 },
  difference: { target: 2, size: 4, max: 9 },
  sum: { target: 10, size: 4, max: 5 },
  product: { target: 12, size: 4 },
  bundle: { target: 100, size: 5 },
  fraction: { target: 4, size: 4, parts: [1, 2] },
  doubleFact: { target: 10, size: 4, max: 5 },
  double: { target: 16, size: 4, parts: [1, 2] },
};

export type Resolved = Required<Pick<MergeSetup, "mode" | "target" | "size">> & MergeSetup;

/** Lessons nest their options under `question`; this flattens them over the mode's defaults. */
export function resolve(setup: MergeSetup): Resolved {
  const mode: Mode = setup.mode ?? "bond";
  const out = { ...MODE_DEFAULTS[mode], ...withoutUndefined(setup), mode } as Resolved;
  if (out.size < 3 || out.size > 6) throw new Error(`number-merge: size ${out.size} is not 3 to 6`);
  if (mode === "bundle" && out.target !== 10 && out.target !== 100) throw new Error("number-merge: bundle makes 10 or 100");
  if (mode === "double" && !isPowerOfTwoTimes(out.target, out.parts ?? [1])) throw new Error(`number-merge: ${out.target} cannot be made by doubling`);
  if (mode === "product" && factorsOf(out.target).length === 0) throw new Error(`number-merge: ${out.target} has no factors to merge`);
  return out;
}

function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/* ---------- merging ---------- */

const isTen = (v: number) => v >= 10 && v % 10 === 0;

/** Whether doubling one of `parts` again and again can land on `target`. */
function isPowerOfTwoTimes(target: number, parts: number[]): boolean {
  return parts.some((p) => {
    for (let v = p; v <= target; v *= 2) if (v === target) return true;
    return false;
  });
}

/** What happens when `a` is moved onto `b`. */
export function verdict(s: Resolved, a: number, b: number): Verdict {
  switch (s.mode) {
    case "bond":
      return a + b === s.target ? { kind: "pop", value: a + b } : { kind: "refuse", reason: "notBond", value: a + b };
    case "difference":
      return Math.abs(a - b) === s.target
        ? { kind: "pop", value: Math.abs(a - b) }
        : { kind: "refuse", reason: "notDifference", value: Math.abs(a - b) };
    case "sum":
    case "fraction": {
      const v = a + b;
      if (v === s.target) return { kind: "pop", value: v };
      return v < s.target ? { kind: "grow", value: v } : { kind: "refuse", reason: "over", value: v };
    }
    case "product": {
      const v = a * b;
      if (v === s.target) return { kind: "pop", value: v };
      if (v < s.target && s.target % v === 0) return { kind: "grow", value: v };
      return { kind: "refuse", reason: v > s.target ? "over" : "notFactor", value: v };
    }
    case "doubleFact":
      return a === b ? { kind: "pop", value: a + b } : { kind: "refuse", reason: "notSame", value: a + b };
    case "double": {
      const v = a + b;
      if (a !== b) return { kind: "refuse", reason: "notSame", value: v };
      if (v === s.target) return { kind: "pop", value: v };
      return v < s.target ? { kind: "grow", value: v } : { kind: "refuse", reason: "over", value: v };
    }
    case "bundle": {
      const v = a + b;
      if (isTen(a) !== isTen(b)) return { kind: "refuse", reason: "mixed", value: v };
      if (!isTen(a)) {
        if (v > 10) return { kind: "refuse", reason: "overTen", value: v };
        return v === 10 && s.target === 10 ? { kind: "pop", value: v } : { kind: "grow", value: v };
      }
      if (v > 100) return { kind: "refuse", reason: "overHundred", value: v };
      return v === 100 ? { kind: "pop", value: v } : { kind: "grow", value: v };
    }
  }
}

/** Whether a refusal is a wrong answer (logged) rather than a move that is simply not allowed. */
export const isWrongAnswer = (s: Resolved): boolean => s.mode === "bond" || s.mode === "difference" || s.mode === "doubleFact";

/* ---------- the board ---------- */

export function neighbours(size: number, i: number): number[] {
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export const areNeighbours = (size: number, a: number, b: number): boolean => neighbours(size, a).includes(b);

/** Every pair of neighbouring cells a child could merge, and what each would do. */
export function moves(s: Resolved, board: Board): { from: number; to: number; verdict: Verdict }[] {
  const out: { from: number; to: number; verdict: Verdict }[] = [];
  board.cells.forEach((a, i) => {
    if (!a) return;
    for (const j of neighbours(board.size, i)) {
      const b = board.cells[j];
      if (b) out.push({ from: i, to: j, verdict: verdict(s, a.v, b.v) });
    }
  });
  return out;
}

/** The pop on the board if there is one, else a move that grows; null when there is nothing. */
export function bestMove(s: Resolved, board: Board) {
  const all = moves(s, board);
  return all.find((m) => m.verdict.kind === "pop") ?? all.find((m) => m.verdict.kind === "grow") ?? null;
}

/**
 * Whether a child can still score. Pair modes need a pop on the board, since
 * every other pair is wrong; building modes need a pop or a merge that grows.
 */
export const playable = (s: Resolved, board: Board): boolean =>
  isWrongAnswer(s) ? moves(s, board).some((m) => m.verdict.kind === "pop") : bestMove(s, board) !== null;

/* ---------- making tiles ---------- */

/** Deterministic random numbers from a string, so a seed always gives the same board. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function factorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 2; d < n; d += 1) if (n % d === 0) out.push(d);
  return out;
}

/** The values a new tile can take in this mode. */
export function tilePool(s: Resolved): number[] {
  const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
  switch (s.mode) {
    case "bond":
      return range(1, s.target - 1);
    case "difference":
      return range(1, s.max ?? s.target + 7);
    case "sum":
      return range(1, Math.min(s.max ?? 9, s.target - 1));
    case "product":
      return factorsOf(s.target).filter((f) => f <= Math.max(2, Math.floor(Math.sqrt(s.target)) + 2));
    case "bundle":
      return s.target === 10 ? range(1, 5) : [...range(1, 5), ...range(1, 5), 10, 20, 30, 40];
    case "fraction":
    case "double":
      return (s.parts ?? [1]).filter((p) => p > 0 && p < s.target);
    case "doubleFact":
      return range(1, s.max ?? 5);
  }
}

export function newTile(s: Resolved, rand: () => number, id: number): Tile {
  const pool = tilePool(s);
  return { id, v: pool[Math.floor(rand() * pool.length)] };
}

/** A pair that always pops, used when random tiles have left nothing to do. */
export function popPair(s: Resolved): [number, number] {
  switch (s.mode) {
    case "bond":
    case "sum":
      return [1, s.target - 1];
    case "difference":
      return [1, 1 + s.target];
    case "product": {
      const f = factorsOf(s.target)[0];
      return [f, s.target / f];
    }
    case "bundle":
      return s.target === 10 ? [5, 5] : [50, 50];
    case "fraction":
      return [1, s.target - 1];
    case "doubleFact":
      return [1, 1];
    case "double":
      return [s.target / 2, s.target / 2];
  }
}

/**
 * Let tiles fall into the gaps and fill the top with new ones, then make sure
 * there is a move. Pure: returns a new board.
 */
export function settle(s: Resolved, board: Board, rand: () => number): { board: Board; reshuffled: boolean } {
  const n = board.size;
  const cells: Cell[] = board.cells.slice();
  let next = board.next;
  for (let c = 0; c < n; c += 1) {
    const column: Tile[] = [];
    for (let r = n - 1; r >= 0; r -= 1) {
      const t = cells[r * n + c];
      if (t) column.push(t);
    }
    for (let r = n - 1, k = 0; r >= 0; r -= 1, k += 1) {
      cells[r * n + c] = k < column.length ? column[k] : newTile(s, rand, next++);
    }
  }
  let out: Board = { size: n, cells, next };
  if (playable(s, out)) return { board: out, reshuffled: false };

  // Nothing to do: new tiles, a bounded number of times, then plant a pair.
  for (let tries = 0; tries < 30; tries += 1) {
    out = { size: n, cells: out.cells.map(() => newTile(s, rand, next++)), next };
    if (playable(s, out)) return { board: out, reshuffled: true };
  }
  const [a, b] = popPair(s);
  const planted = out.cells.slice();
  planted[n * n - 1] = { id: next++, v: a };
  planted[n * n - 2] = { id: next++, v: b };
  return { board: { size: n, cells: planted, next }, reshuffled: true };
}

export function newBoard(s: Resolved, rand: () => number): Board {
  return settle(s, { size: s.size, cells: Array(s.size * s.size).fill(null), next: 1 }, rand).board;
}

/**
 * Apply a merge of `from` onto `to`. A refused merge returns the board unchanged.
 * A pop empties both cells; a grow empties `from` and grows `to`. The gaps are
 * not filled here — the activity animates the pop first, then calls `settle`.
 */
export function merge(s: Resolved, board: Board, from: number, to: number): { board: Board; verdict: Verdict } | null {
  const a = board.cells[from];
  const b = board.cells[to];
  if (!a || !b || from === to || !areNeighbours(board.size, from, to)) return null;
  const v = verdict(s, a.v, b.v);
  if (v.kind === "refuse") return { board, verdict: v };
  const cells = board.cells.slice();
  cells[from] = null;
  cells[to] = v.kind === "pop" ? null : { id: b.id, v: v.value };
  return { board: { ...board, cells }, verdict: v };
}

/* ---------- words for a number ---------- */

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A fraction tile's value in lowest terms, as [numerator, denominator]. */
export function fractionOf(v: number, den: number): [number, number] {
  const g = gcd(v, den);
  return [v / g, den / g];
}
