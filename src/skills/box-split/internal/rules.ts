/**
 * Box Split: the rules, with no React in sight.
 *
 * A square grid has numbers in some of its squares. Split the whole grid into
 * rectangles ("boxes") so that every box holds exactly one number, and that
 * number is how many squares the box covers.
 *
 * The solver works the way a person does, one named rule at a time, easiest
 * first, and never guesses:
 *
 * - `single-fit`  a number has only one box left that fits. Draw it.
 * - `only-reach`  an empty square only one number's boxes can reach, so that
 *                 number's box must cover it.
 * - `overlap`     every box left for a number covers the same squares, so no
 *                 other number can have them.
 *
 * A puzzle the solver finishes has exactly one answer, because every step is
 * forced. The generator keeps only those, and rates each by the hardest rule
 * it needed — which is how a lesson asks for "puzzles that need only-reach".
 */

export type Technique = "single-fit" | "only-reach" | "overlap";
export const TECHNIQUES: readonly Technique[] = ["single-fit", "only-reach", "overlap"];

/** Every rule up to and including this one. */
export const upTo = (t: Technique): Technique[] => TECHNIQUES.slice(0, TECHNIQUES.indexOf(t) + 1);

/** A box: top row, left column, rows tall, columns wide. */
export interface Rect {
  r: number;
  c: number;
  h: number;
  w: number;
}

export interface Clue {
  /** Row-major cell index. */
  cell: number;
  area: number;
}

export interface Puzzle {
  n: number;
  clues: Clue[];
  /** `answer[k]` is the box for `clues[k]`. */
  answer: Rect[];
  /** The hardest rule the solver needed. */
  hardest: Technique;
}

export type Shapes = "any" | "strips";

export interface GenSpec {
  size: number;
  /** Smallest and largest box. A 1×1 box is allowed only as a last resort when `minArea` > 1. */
  minArea?: number;
  maxArea: number;
  /** The hardest rule a puzzle may need — and, unless `needs` says otherwise, must need. */
  technique: Technique;
  /** The rule the puzzle must use at least once. Defaults to `technique`; `single-fit` needs nothing extra. */
  needs?: Technique;
  /** `strips`: only 1×n lines and 2×2 squares. */
  shapes?: Shapes;
  /** At most this many 1-square boxes. */
  maxOnes?: number;
  /** At least this many boxes whose size can be drawn as two different shapes (6 = 1×6 or 2×3). */
  factorRich?: number;
}

/* ---------- small helpers ---------- */

/** A seeded random in [0, 1): the same seed always gives the same numbers. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
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

const pick = <T,>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

export const area = (b: Rect): number => b.h * b.w;

export const sameRect = (a: Rect, b: Rect): boolean => a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

export function cellsOf(b: Rect, n: number): number[] {
  const out: number[] = [];
  for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) out.push(r * n + c);
  return out;
}

export const contains = (b: Rect, n: number, cell: number): boolean => {
  const r = Math.floor(cell / n);
  const c = cell % n;
  return r >= b.r && r < b.r + b.h && c >= b.c && c < b.c + b.w;
};

/** The box with these two squares at opposite corners. */
export function rectBetween(n: number, a: number, b: number): Rect {
  const [ra, ca, rb, cb] = [Math.floor(a / n), a % n, Math.floor(b / n), b % n];
  return { r: Math.min(ra, rb), c: Math.min(ca, cb), h: Math.abs(ra - rb) + 1, w: Math.abs(ca - cb) + 1 };
}

/** Shapes a box of this size can take, rows × columns: 6 gives 1×6, 2×3, 3×2, 6×1. */
export function shapesFor(size: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let h = 1; h <= Math.min(size, n); h++) if (size % h === 0 && size / h <= n) out.push([h, size / h]);
  return out;
}

/** Whether a size can be drawn as two really different shapes, not just turned round. */
export const isFactorRich = (size: number): boolean => {
  let pairs = 0;
  for (let h = 1; h * h <= size; h++) if (size % h === 0) pairs++;
  return pairs >= 2;
};

const isStrip = (h: number, w: number): boolean => h === 1 || w === 1 || (h === 2 && w === 2);

/* ---------- candidates ---------- */

/**
 * Every box that could still belong to clue `k`: the right size, inside the
 * grid, over its own number and no other, and clear of squares already taken.
 */
export function candidatesFor(p: Pick<Puzzle, "n" | "clues">, k: number, taken: Int16Array): Rect[] {
  const { n, clues } = p;
  const { cell, area: size } = clues[k];
  const r0 = Math.floor(cell / n);
  const c0 = cell % n;
  const out: Rect[] = [];
  for (const [h, w] of shapesFor(size, n)) {
    for (let r = Math.max(0, r0 - h + 1); r <= Math.min(r0, n - h); r++) {
      for (let c = Math.max(0, c0 - w + 1); c <= Math.min(c0, n - w); c++) {
        const box = { r, c, h, w };
        let ok = true;
        for (const i of cellsOf(box, n)) {
          if (taken[i] !== -1 && taken[i] !== k) { ok = false; break; }
          if (i !== cell && clueAt(p, i) !== -1) { ok = false; break; }
        }
        if (ok) out.push(box);
      }
    }
  }
  return out;
}

const clueIndex = new WeakMap<object, Int16Array>();
/** Which clue sits in a square, or -1. */
export function clueAt(p: Pick<Puzzle, "n" | "clues">, cell: number): number {
  let idx = clueIndex.get(p.clues);
  if (!idx) {
    idx = new Int16Array(p.n * p.n).fill(-1);
    p.clues.forEach((cl, k) => { idx![cl.cell] = k; });
    clueIndex.set(p.clues, idx);
  }
  return idx[cell];
}

/* ---------- the solver ---------- */

export interface Step {
  technique: Technique;
  /** The clue the step is about. */
  clue: number;
  /** only-reach: the square only this clue can reach. */
  cell?: number;
  /** overlap: the squares every box for this clue covers. */
  cells?: number[];
  /** Set when the step draws a box. */
  placed?: Rect;
}

export interface SolveState {
  n: number;
  clues: Clue[];
  cand: Rect[][];
  /** Square → clue whose box is drawn over it, or -1. */
  taken: Int16Array;
  done: boolean[];
}

/** A fresh state, with the boxes already drawn for these clues. */
export function stateOf(p: Pick<Puzzle, "n" | "clues">, drawn: (Rect | null)[] = []): SolveState {
  const taken = new Int16Array(p.n * p.n).fill(-1);
  const done = p.clues.map((_, k) => Boolean(drawn[k]));
  drawn.forEach((b, k) => { if (b) for (const i of cellsOf(b, p.n)) taken[i] = k; });
  const cand = p.clues.map((_, k) => (drawn[k] ? [drawn[k]!] : candidatesFor(p, k, taken)));
  return { n: p.n, clues: p.clues, cand, taken, done };
}

function place(s: SolveState, k: number, box: Rect) {
  s.done[k] = true;
  s.cand[k] = [box];
  const mine = cellsOf(box, s.n);
  for (const i of mine) s.taken[i] = k;
  const set = new Set(mine);
  for (let j = 0; j < s.cand.length; j++) {
    if (j === k || s.done[j]) continue;
    s.cand[j] = s.cand[j].filter((b) => !cellsOf(b, s.n).some((i) => set.has(i)));
  }
}

/** Places a clue left with one box, if that is all the step changed. */
function settleOne(s: SolveState, k: number): Rect | undefined {
  if (!s.done[k] && s.cand[k].length === 1) {
    const box = s.cand[k][0];
    place(s, k, box);
    return box;
  }
  return undefined;
}

/** The next step the given rules can take, applied to `s`; undefined when stuck or done. */
export function step(s: SolveState, rules: readonly Technique[]): Step | undefined {
  const open = s.clues.map((_, k) => k).filter((k) => !s.done[k]);
  if (!open.length) return undefined;

  // The biggest sure box first: it clears the most, and it is the one worth a hint.
  let sure = -1;
  for (const k of open) if (s.cand[k].length === 1 && (sure === -1 || s.clues[k].area > s.clues[sure].area)) sure = k;
  if (sure !== -1) return { technique: "single-fit", clue: sure, placed: settleOne(s, sure) };

  if (rules.includes("only-reach")) {
    // Squares nobody has yet, and who could still reach each.
    const reach = new Map<number, Set<number>>();
    for (const k of open) {
      for (const b of s.cand[k]) for (const i of cellsOf(b, s.n)) {
        if (s.taken[i] !== -1) continue;
        let who = reach.get(i);
        if (!who) reach.set(i, (who = new Set()));
        who.add(k);
      }
    }
    for (let i = 0; i < s.n * s.n; i++) {
      const who = reach.get(i);
      if (s.taken[i] !== -1 || !who || who.size !== 1) continue;
      const [k] = who;
      const before = s.cand[k].length;
      s.cand[k] = s.cand[k].filter((b) => contains(b, s.n, i));
      if (s.cand[k].length < before) return { technique: "only-reach", clue: k, cell: i, placed: settleOne(s, k) };
    }
  }

  if (rules.includes("overlap")) {
    for (const k of open) {
      const [first, ...rest] = s.cand[k];
      if (!first) continue;
      let common = cellsOf(first, s.n).filter((i) => s.taken[i] === -1);
      for (const b of rest) common = common.filter((i) => contains(b, s.n, i));
      if (!common.length) continue;
      const shared = new Set(common);
      let changed = false;
      for (const j of open) {
        if (j === k) continue;
        const before = s.cand[j].length;
        s.cand[j] = s.cand[j].filter((b) => !cellsOf(b, s.n).some((i) => shared.has(i)));
        if (s.cand[j].length < before) changed = true;
      }
      if (changed) return { technique: "overlap", clue: k, cells: common };
    }
  }
  return undefined;
}

export interface Solution {
  solved: boolean;
  steps: Step[];
  /** The hardest rule used; `single-fit` when nothing else was needed. */
  hardest: Technique;
  boxes: (Rect | null)[];
}

export function solve(p: Pick<Puzzle, "n" | "clues">, rules: readonly Technique[] = TECHNIQUES, drawn: (Rect | null)[] = []): Solution {
  const s = stateOf(p, drawn);
  const steps: Step[] = [];
  let hardest = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    const st = step(s, rules);
    if (!st) break;
    steps.push(st);
    hardest = Math.max(hardest, TECHNIQUES.indexOf(st.technique));
  }
  const solved = s.done.every(Boolean) && s.taken.every((k) => k !== -1);
  return { solved, steps, hardest: TECHNIQUES[hardest], boxes: s.cand.map((c, k) => (s.done[k] ? c[0] : null)) };
}

/**
 * What a hint points at, from the boxes drawn so far: the next box the rules
 * can prove, and the rule that proved it. Reasoning steps that only narrow
 * other numbers come along as `because`, so the hint names the rule a person
 * needs rather than the easiest one that happened to fire.
 */
export interface NextBox {
  /** The clue whose box can be drawn next, and that box. */
  clue: number;
  box: Rect;
  /** The rule that made it certain, and the clue that rule was about (often the same one). */
  technique: Technique;
  reasonClue: number;
  cell?: number;
  cells?: number[];
}

export function nextBox(p: Puzzle, drawn: (Rect | null)[], rules: readonly Technique[] = TECHNIQUES): NextBox | null {
  const s = stateOf(p, drawn);
  let hardest = 0;
  let reason: Step | undefined;
  for (let guard = 0; guard < 10_000; guard++) {
    const st = step(s, rules);
    if (!st) return null;
    if (TECHNIQUES.indexOf(st.technique) >= hardest) {
      hardest = TECHNIQUES.indexOf(st.technique);
      reason = st;
    }
    if (st.placed && !drawn[st.clue]) {
      // The step that placed it is the reason, unless an earlier, harder step made it possible.
      const why = reason && reason.technique !== "single-fit" ? reason : st;
      return { clue: st.clue, box: st.placed, technique: why.technique, reasonClue: why.clue, cell: why.cell, cells: why.cells };
    }
  }
  return null;
}

/* ---------- checking a drawn box ---------- */

export type Verdict =
  | { kind: "right"; clue: number }
  /** A box that fits the rules but is not where this number's box goes: a wrong answer. */
  | { kind: "wrong"; clue: number }
  /** A box the rules forbid; refused with a reason, not counted as an answer. */
  | { kind: "refuse"; reason: "noNumber" | "twoNumbers" | "tooBig" | "tooSmall" | "overlaps"; clue?: number; size: number };

export function judge(p: Puzzle, box: Rect, drawn: (Rect | null)[]): Verdict {
  const cells = cellsOf(box, p.n);
  const size = cells.length;
  const inside = cells.map((i) => clueAt(p, i)).filter((k) => k !== -1);
  const taken = new Set<number>();
  drawn.forEach((b) => { if (b) cellsOf(b, p.n).forEach((i) => taken.add(i)); });
  if (cells.some((i) => taken.has(i))) return { kind: "refuse", reason: "overlaps", size };
  if (inside.length === 0) return { kind: "refuse", reason: "noNumber", size };
  if (inside.length > 1) return { kind: "refuse", reason: "twoNumbers", size };
  const k = inside[0];
  const want = p.clues[k].area;
  if (size > want) return { kind: "refuse", reason: "tooBig", clue: k, size };
  if (size < want) return { kind: "refuse", reason: "tooSmall", clue: k, size };
  return sameRect(box, p.answer[k]) ? { kind: "right", clue: k } : { kind: "wrong", clue: k };
}

/* ---------- the generator ---------- */

function partition(spec: GenSpec, rand: () => number): Rect[] | null {
  const n = spec.size;
  const minArea = Math.max(1, spec.minArea ?? 1);
  const owner = new Int16Array(n * n).fill(-1);
  const boxes: Rect[] = [];
  let ones = 0;
  for (let i = 0; i < n * n; i++) {
    if (owner[i] !== -1) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    // Widest run of free squares to the right, then how far down each width reaches.
    let maxW = 0;
    while (c + maxW < n && owner[i + maxW] === -1) maxW++;
    const options: Rect[] = [];
    for (let w = 1; w <= maxW; w++) {
      for (let h = 1; r + h <= n; h++) {
        let free = true;
        for (let x = 0; x < w; x++) if (owner[(r + h - 1) * n + c + x] !== -1) { free = false; break; }
        if (!free) break;
        const size = h * w;
        if (size > spec.maxArea) break;
        if (size < minArea) continue;
        if (spec.shapes === "strips" && !isStrip(h, w)) continue;
        options.push({ r, c, h, w });
      }
    }
    // Pick a size first, then a shape: otherwise long thin strips crowd out squares.
    let box: Rect;
    if (options.length) {
      const sizes = [...new Set(options.map(area))];
      const size = pick(sizes, rand);
      box = pick(options.filter((o) => area(o) === size), rand);
    } else {
      box = { r, c, h: 1, w: 1 };
    }
    if (area(box) === 1 && ++ones > (spec.maxOnes ?? Infinity)) return null;
    for (const k of cellsOf(box, n)) owner[k] = boxes.length;
    boxes.push(box);
  }
  return boxes;
}

function withClues(n: number, boxes: Rect[], rand: () => number): Pick<Puzzle, "n" | "clues" | "answer"> {
  const order = boxes.map((b) => ({ b, cell: pick(cellsOf(b, n), rand) })).sort((x, y) => x.cell - y.cell);
  return { n, clues: order.map((o) => ({ cell: o.cell, area: area(o.b) })), answer: order.map((o) => o.b) };
}

/**
 * Rows, each one full-width box, every number at the left edge. Always single-fit:
 * any box taller than one row would reach the number below. The last resort.
 */
export function fallbackPuzzle(n: number): Puzzle {
  const answer = Array.from({ length: n }, (_, r) => ({ r, c: 0, h: 1, w: n }));
  return { n, clues: answer.map((b) => ({ cell: b.r * n, area: n })), answer, hardest: "single-fit" };
}

export function generate(spec: GenSpec, seed: string, attempts = 600): Puzzle {
  if (spec.size < 2 || spec.size > 15) throw new Error(`Box Split: a ${spec.size}×${spec.size} grid is not supported`);
  if (spec.maxArea < 1 || (spec.minArea ?? 1) > spec.maxArea) throw new Error("Box Split: minArea is larger than maxArea");
  const needs = spec.needs ?? spec.technique;
  const rules = upTo(spec.technique);
  const rand = seededRandom(`box-split:${seed}`);
  let loose: Puzzle | null = null;
  for (let a = 0; a < attempts; a++) {
    const boxes = partition(spec, rand);
    if (!boxes || boxes.length < 2) continue;
    if (spec.factorRich && boxes.filter((b) => isFactorRich(area(b))).length < spec.factorRich) continue;
    // A few clue placements per partition: where the number sits is most of the difficulty.
    for (let t = 0; t < 4; t++) {
      const p = withClues(spec.size, boxes, rand);
      const sol = solve(p, rules);
      if (!sol.solved) continue;
      const puzzle = { ...p, hardest: sol.hardest };
      if (TECHNIQUES.indexOf(sol.hardest) >= TECHNIQUES.indexOf(needs)) return puzzle;
      loose ??= puzzle;
    }
  }
  return loose ?? fallbackPuzzle(spec.size);
}

/** A puzzle as one string, for the round's answer key: each box as row,col,rows×cols. */
export const answerKey = (p: Puzzle): string => p.answer.map((b) => `${b.r},${b.c},${b.h}x${b.w}`).join(";");
