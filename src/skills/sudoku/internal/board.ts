/**
 * Sudoku geometry and randomness. Pure: no React, no i18n.
 *
 * A board is a flat array of `n * n` numbers, row by row; 0 is an empty cell.
 * Three shapes are taught: 4×4 (boxes of 2×2), 6×6 (2 rows × 3 columns) and
 * 9×9 (3×3). Candidates are bitmasks: digit d is bit d − 1.
 */

export type Size = 4 | 6 | 9;

export interface Shape {
  n: Size;
  /** Rows in one box. */
  br: number;
  /** Columns in one box. */
  bc: number;
}

export const SHAPES: Record<Size, Shape> = {
  4: { n: 4, br: 2, bc: 2 },
  6: { n: 6, br: 2, bc: 3 },
  9: { n: 9, br: 3, bc: 3 },
};

export type HouseKind = "row" | "col" | "box";

export interface House {
  kind: HouseKind;
  /** 0-based: row 0 is the top row, box 0 the top-left box, reading order. */
  index: number;
  cells: number[];
}

export interface Geometry extends Shape {
  houses: House[];
  /** For every cell, the cells it shares a row, column or box with. */
  peers: number[][];
  /** For every cell, its row, column and box. */
  housesOf: [House, House, House][];
  all: number;
}

const geometries = new Map<Size, Geometry>();

export function geometry(n: Size): Geometry {
  const cached = geometries.get(n);
  if (cached) return cached;
  const { br, bc } = SHAPES[n];
  const range = [...Array(n).keys()];
  const rows = range.map((r): House => ({ kind: "row", index: r, cells: range.map((c) => r * n + c) }));
  const cols = range.map((c): House => ({ kind: "col", index: c, cells: range.map((r) => r * n + c) }));
  const boxes: House[] = [];
  for (let R = 0; R < n; R += br) {
    for (let C = 0; C < n; C += bc) {
      const cells: number[] = [];
      for (let a = 0; a < br; a += 1) for (let b = 0; b < bc; b += 1) cells.push((R + a) * n + C + b);
      boxes.push({ kind: "box", index: boxes.length, cells });
    }
  }
  const housesOf = range.flatMap((r) =>
    range.map((c): [House, House, House] => [rows[r], cols[c], boxes[boxOf(n, r * n + c)]]),
  );
  const peers = housesOf.map((hs, i) => {
    const set = new Set<number>();
    for (const h of hs) for (const x of h.cells) if (x !== i) set.add(x);
    return [...set];
  });
  const g: Geometry = { n, br, bc, houses: [...rows, ...cols, ...boxes], peers, housesOf, all: (1 << n) - 1 };
  geometries.set(n, g);
  return g;
}

export const rowOf = (n: number, i: number): number => Math.floor(i / n);
export const colOf = (n: number, i: number): number => i % n;
export function boxOf(n: Size, i: number): number {
  const { br, bc } = SHAPES[n];
  return Math.floor(rowOf(n, i) / br) * (n / bc) + Math.floor(colOf(n, i) / bc);
}

export const bit = (d: number): number => 1 << (d - 1);
export const has = (mask: number, d: number): boolean => (mask & bit(d)) !== 0;
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; mask >> (d - 1); d += 1) if (has(mask, d)) out.push(d);
  return out;
}
export function popcount(mask: number): number {
  let k = 0;
  for (let m = mask; m; m &= m - 1) k += 1;
  return k;
}

/* ---------- randomness ---------- */

/** A small seeded generator (mulberry32 over a string hash). */
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

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Any solved grid can be turned into another by moves that keep every rule:
 * swap rows inside a band, swap bands, the same for columns and stacks, and
 * rename the digits. None of them changes which techniques a puzzle needs, so
 * a puzzle stays exactly as hard after it.
 */
export function remix(cells: number[], n: Size, rand: () => number): number[] {
  const { br, bc } = SHAPES[n];
  const bands = shuffle([...Array(n / br).keys()], rand);
  const stacks = shuffle([...Array(n / bc).keys()], rand);
  const rows = bands.flatMap((b) => shuffle([...Array(br).keys()], rand).map((r) => b * br + r));
  const cols = stacks.flatMap((s) => shuffle([...Array(bc).keys()], rand).map((c) => s * bc + c));
  const digits = [0, ...shuffle([...Array(n).keys()].map((d) => d + 1), rand)];
  const out: number[] = [];
  for (const r of rows) for (const c of cols) out.push(digits[cells[r * n + c]]);
  return out;
}

/** A random solved grid: a valid pattern, remixed. */
export function solvedGrid(n: Size, rand: () => number): number[] {
  const { br, bc } = SHAPES[n];
  const base: number[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) base.push(((bc * (r % br) + Math.floor(r / br) + c) % n) + 1);
  }
  return remix(base, n, rand);
}

/** Whether a full grid keeps every rule. */
export function isValidSolution(cells: number[], n: Size): boolean {
  const g = geometry(n);
  if (cells.length !== n * n) return false;
  return g.houses.every((h) => {
    let seen = 0;
    for (const x of h.cells) {
      const v = cells[x];
      if (v < 1 || v > n || has(seen, v)) return false;
      seen |= bit(v);
    }
    return true;
  });
}
