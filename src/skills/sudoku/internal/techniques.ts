import {
  bit,
  digitsOf,
  geometry,
  has,
  popcount,
  type Geometry,
  type House,
  type Size,
} from "./board";

/**
 * The solving techniques Koda teaches, easiest first.
 *
 * The order is the curriculum: a puzzle is rated by the hardest technique a
 * person needs when they always use the easiest one that works, so "a Pointing
 * puzzle" means one that cannot be finished with singles alone but can with
 * Pointing.
 */
export const TECHNIQUES = [
  "full-house",
  "hidden-single-box",
  "hidden-single-line",
  "naked-single",
  "pointing",
  "claiming",
  "naked-pair",
  "hidden-pair",
  "x-wing",
] as const;

export type Technique = (typeof TECHNIQUES)[number];

export const rank = (t: Technique): number => TECHNIQUES.indexOf(t);
export const upTo = (t: Technique): Technique[] => TECHNIQUES.slice(0, rank(t) + 1);

/** Techniques that place a number. The rest remove candidates (notes). */
export const PLACES: ReadonlySet<Technique> = new Set([
  "full-house",
  "hidden-single-box",
  "hidden-single-line",
  "naked-single",
]);

export interface Move {
  cell: number;
  value: number;
}

/**
 * One deduction, with what a person would point at to explain it: the house it
 * happens in, the cells that make the pattern, and the digits involved.
 */
export interface Step {
  technique: Technique;
  placements: Move[];
  eliminations: Move[];
  house?: House;
  /** A second house: the line for Pointing, the box for Claiming, X-Wing's other line. */
  other?: House;
  cells: number[];
  digits: number[];
}

/** Values and candidates. A placed cell has no candidates. */
export interface State {
  n: Size;
  grid: number[];
  cand: number[];
}

export function stateOf(grid: number[], n: Size): State {
  const g = geometry(n);
  const cand = grid.map((v, i) => {
    if (v) return 0;
    let mask = g.all;
    for (const p of g.peers[i]) if (grid[p]) mask &= ~bit(grid[p]);
    return mask;
  });
  return { n, grid: grid.slice(), cand };
}

export const cloneState = (s: State): State => ({ n: s.n, grid: s.grid.slice(), cand: s.cand.slice() });

export function place(s: State, cell: number, value: number): void {
  const g = geometry(s.n);
  s.grid[cell] = value;
  s.cand[cell] = 0;
  for (const p of g.peers[cell]) s.cand[p] &= ~bit(value);
}

export function apply(s: State, step: Step): void {
  for (const e of step.eliminations) s.cand[e.cell] &= ~bit(e.value);
  for (const m of step.placements) if (!s.grid[m.cell]) place(s, m.cell, m.value);
}

const empties = (s: State, h: House): number[] => h.cells.filter((x) => !s.grid[x]);
const placedIn = (s: State, h: House): number => h.cells.reduce((m, x) => (s.grid[x] ? m | bit(s.grid[x]) : m), 0);
const spotsFor = (s: State, h: House, d: number): number[] => h.cells.filter((x) => has(s.cand[x], d));

/* ---------- placing techniques ---------- */

function fullHouse(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const h of g.houses) {
    const open = empties(s, h);
    if (open.length !== 1) continue;
    const value = digitsOf(g.all & ~placedIn(s, h))[0];
    if (!value) continue;
    out.push({ technique: "full-house", placements: [{ cell: open[0], value }], eliminations: [], house: h, cells: open, digits: [value] });
  }
  return out;
}

function hiddenSingles(s: State, g: Geometry, kinds: House["kind"][], technique: Technique): Step[] {
  const out: Step[] = [];
  for (const h of g.houses) {
    if (!kinds.includes(h.kind)) continue;
    const missing = g.all & ~placedIn(s, h);
    for (const d of digitsOf(missing)) {
      const spots = spotsFor(s, h, d);
      if (spots.length === 1) {
        out.push({ technique, placements: [{ cell: spots[0], value: d }], eliminations: [], house: h, cells: spots, digits: [d] });
      }
    }
  }
  return out;
}

function nakedSingles(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  s.cand.forEach((mask, i) => {
    if (s.grid[i] || popcount(mask) !== 1) return;
    const d = digitsOf(mask)[0];
    out.push({ technique: "naked-single", placements: [{ cell: i, value: d }], eliminations: [], house: g.housesOf[i][2], cells: [i], digits: [d] });
  });
  return out;
}

/* ---------- note techniques ---------- */

/** Box → line: every spot for d in a box is on one line, so d leaves the rest of that line. */
function pointing(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const box of g.houses.filter((h) => h.kind === "box")) {
    for (let d = 1; d <= g.n; d += 1) {
      const spots = spotsFor(s, box, d);
      if (spots.length < 2) continue;
      for (const kind of ["row", "col"] as const) {
        const lines = new Set(spots.map((x) => g.housesOf[x][kind === "row" ? 0 : 1]));
        if (lines.size !== 1) continue;
        const line = [...lines][0];
        const elim = line.cells.filter((x) => !box.cells.includes(x) && has(s.cand[x], d));
        if (elim.length) {
          out.push({ technique: "pointing", placements: [], eliminations: elim.map((cell) => ({ cell, value: d })), house: box, other: line, cells: spots, digits: [d] });
        }
      }
    }
  }
  return out;
}

/** Line → box: every spot for d in a line is in one box, so d leaves the rest of that box. */
function claiming(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const line of g.houses.filter((h) => h.kind !== "box")) {
    for (let d = 1; d <= g.n; d += 1) {
      const spots = spotsFor(s, line, d);
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map((x) => g.housesOf[x][2]));
      if (boxes.size !== 1) continue;
      const box = [...boxes][0];
      const elim = box.cells.filter((x) => !line.cells.includes(x) && has(s.cand[x], d));
      if (elim.length) {
        out.push({ technique: "claiming", placements: [], eliminations: elim.map((cell) => ({ cell, value: d })), house: line, other: box, cells: spots, digits: [d] });
      }
    }
  }
  return out;
}

function nakedPairs(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const h of g.houses) {
    const open = empties(s, h).filter((x) => popcount(s.cand[x]) === 2);
    for (let i = 0; i < open.length; i += 1) {
      for (let j = i + 1; j < open.length; j += 1) {
        const mask = s.cand[open[i]];
        if (s.cand[open[j]] !== mask) continue;
        const pair = digitsOf(mask);
        const elim = h.cells
          .filter((x) => x !== open[i] && x !== open[j])
          .flatMap((x) => pair.filter((d) => has(s.cand[x], d)).map((value) => ({ cell: x, value })));
        if (elim.length) out.push({ technique: "naked-pair", placements: [], eliminations: elim, house: h, cells: [open[i], open[j]], digits: pair });
      }
    }
  }
  return out;
}

function hiddenPairs(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const h of g.houses) {
    const missing = digitsOf(g.all & ~placedIn(s, h));
    const twos = missing.filter((d) => spotsFor(s, h, d).length === 2);
    for (let i = 0; i < twos.length; i += 1) {
      for (let j = i + 1; j < twos.length; j += 1) {
        const a = spotsFor(s, h, twos[i]);
        const b = spotsFor(s, h, twos[j]);
        if (a[0] !== b[0] || a[1] !== b[1]) continue;
        const keep = bit(twos[i]) | bit(twos[j]);
        const elim = a.flatMap((cell) => digitsOf(s.cand[cell] & ~keep).map((value) => ({ cell, value })));
        if (elim.length) out.push({ technique: "hidden-pair", placements: [], eliminations: elim, house: h, cells: a, digits: [twos[i], twos[j]] });
      }
    }
  }
  return out;
}

function xWings(s: State, g: Geometry): Step[] {
  const out: Step[] = [];
  for (const kind of ["row", "col"] as const) {
    const lines = g.houses.filter((h) => h.kind === kind);
    const across = g.houses.filter((h) => h.kind === (kind === "row" ? "col" : "row"));
    const pos = (x: number) => (kind === "row" ? x % g.n : Math.floor(x / g.n));
    for (let d = 1; d <= g.n; d += 1) {
      const twos = lines
        .map((line) => ({ line, spots: spotsFor(s, line, d) }))
        .filter((x) => x.spots.length === 2);
      for (let i = 0; i < twos.length; i += 1) {
        for (let j = i + 1; j < twos.length; j += 1) {
          const [a, b] = [twos[i], twos[j]];
          if (pos(a.spots[0]) !== pos(b.spots[0]) || pos(a.spots[1]) !== pos(b.spots[1])) continue;
          const corners = [...a.spots, ...b.spots];
          const elim = [across[pos(a.spots[0])], across[pos(a.spots[1])]]
            .flatMap((h) => h.cells)
            .filter((x) => !corners.includes(x) && has(s.cand[x], d))
            .map((cell) => ({ cell, value: d }));
          if (elim.length) out.push({ technique: "x-wing", placements: [], eliminations: elim, house: a.line, other: b.line, cells: corners, digits: [d] });
        }
      }
    }
  }
  return out;
}

const FINDERS: Record<Technique, (s: State, g: Geometry) => Step[]> = {
  "full-house": fullHouse,
  "hidden-single-box": (s, g) => hiddenSingles(s, g, ["box"], "hidden-single-box"),
  "hidden-single-line": (s, g) => hiddenSingles(s, g, ["row", "col"], "hidden-single-line"),
  "naked-single": nakedSingles,
  pointing,
  claiming,
  "naked-pair": nakedPairs,
  "hidden-pair": hiddenPairs,
  "x-wing": xWings,
};

/** Every instance of one technique on this board. */
export const find = (s: State, t: Technique): Step[] => FINDERS[t](s, geometry(s.n));

/** The easiest step available, using only `allowed`. */
export function nextStep(s: State, allowed: readonly Technique[]): Step | undefined {
  for (const t of TECHNIQUES) {
    if (!allowed.includes(t)) continue;
    const steps = find(s, t);
    if (steps.length) return steps[0];
  }
  return undefined;
}

export interface Solve {
  solved: boolean;
  /** The hardest technique used, easiest-first. */
  hardest?: Technique;
  /** How many times each technique was used. */
  uses: Partial<Record<Technique, number>>;
  grid: number[];
}

/**
 * Solve the way a person would: always the easiest step that works. A board this
 * finishes has exactly one answer, because every step is forced.
 */
export function solveLogically(givens: number[], n: Size, allowed: readonly Technique[] = TECHNIQUES): Solve {
  const s = stateOf(givens, n);
  const uses: Partial<Record<Technique, number>> = {};
  let hardest: Technique | undefined;
  for (let guard = 0; guard < 2000; guard += 1) {
    if (s.grid.every(Boolean)) return { solved: true, hardest, uses, grid: s.grid };
    // A cell with nothing left means the givens contradict each other.
    if (s.grid.some((v, i) => !v && !s.cand[i])) break;
    const step = nextStep(s, allowed);
    if (!step) break;
    uses[step.technique] = (uses[step.technique] ?? 0) + 1;
    if (!hardest || rank(step.technique) > rank(hardest)) hardest = step.technique;
    apply(s, step);
  }
  return { solved: false, hardest, uses, grid: s.grid };
}

/**
 * Placements a person can make right now with techniques up to `t`, after
 * using every note-removing step of `t` that is on the board. This is the set a
 * drill accepts: any of them is a correct find.
 */
export function findsWith(s: State, t: Technique): Move[] {
  const work = cloneState(s);
  if (!PLACES.has(t)) {
    for (const step of find(work, t)) for (const e of step.eliminations) work.cand[e.cell] &= ~bit(e.value);
  }
  const singles = upTo(t).filter((x) => PLACES.has(x));
  const seen = new Set<string>();
  const out: Move[] = [];
  for (const x of singles) {
    for (const step of find(work, x)) {
      for (const m of step.placements) {
        const key = `${m.cell}:${m.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(m);
        }
      }
    }
  }
  return out;
}
