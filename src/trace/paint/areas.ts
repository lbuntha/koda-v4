/**
 * Colouring: from line art to areas, and from a child's painting to a score.
 *
 * The item's strokes are stamped onto a GRID×GRID board as walls; every
 * connected run of free cells is an area (a flood fill, done once for all of
 * them). A step owns the areas its seeds land in. The child's paint lives on
 * the same board — one crayon per cell — so what is shown, what is checked
 * and what is scored are the same cells. Pure; no canvas.
 */

import { strokePolyline } from "../geometry/bezier";
import type { PaintStep, Point, TraceItem } from "../geometry/types";
import { GRID, CELL, SPECK } from "./grid";
import { crayonIndex } from "./palette";
import { pictureWalls, unpackMask } from "./picture";

export { GRID, CELL, SPECK };
/** How thick a line is as a wall, in units. The drawn line is thicker, so a wall's edge never shows. */
export const WALL = 14;
export const LINE = 18;

export interface Areas {
  /** Per cell: the area it belongs to, or -1 on a line. */
  labels: Int32Array;
  /** Cells in each area. */
  sizes: number[];
  /** Parts that are strips walled in between two close lines (see `reclaim`): slivers, however long. */
  strips?: Set<number>;
}

const cellOf = (v: number) => Math.min(GRID - 1, Math.max(0, Math.floor(v / CELL)));

/** Mark every cell within `r` units of `p`. */
function stamp(board: Uint8Array, p: Point, r: number, value = 1) {
  const rc = r / CELL;
  const cx = p.x / CELL;
  const cy = p.y / CELL;
  for (let y = Math.max(0, Math.floor(cy - rc)); y <= Math.min(GRID - 1, Math.ceil(cy + rc)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rc)); x <= Math.min(GRID - 1, Math.ceil(cx + rc)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rc * rc) board[y * GRID + x] = value;
    }
  }
}

/** Stamp along a polyline, a disc every half cell. */
function stampLine(board: Uint8Array, pts: Point[], r: number) {
  if (pts.length === 1) return stamp(board, pts[0], r);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
    for (let k = 0; k <= n; k++) stamp(board, { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, r);
  }
}

export function walls(item: Pick<TraceItem, "strokes" | "paint">): Uint8Array {
  // A picture's lines first, then any lines drawn on top to close a gap.
  // Smoothed by the magic pen, the strokes are the line art and the picture's own lines step aside.
  const picture = item.paint?.picture;
  const thick = picture && !picture.smooth ? pictureWalls(picture) : null;
  const board = thick ? thick.slice() : new Uint8Array(GRID * GRID);
  for (const s of item.strokes) {
    if (s.shape === "dot" || s.nodes.length === 1) {
      const n = s.nodes[0];
      if (n) stamp(board, n, (s.radius ?? 20) + WALL / 2);
      continue;
    }
    stampLine(board, strokePolyline(s), WALL / 2);
  }
  return board;
}

/** Every area of the line art, labelled in one pass (4-connected, so a diagonal gap in a line does not leak). */
export function labelAreas(item: Pick<TraceItem, "strokes" | "paint">): Areas {
  const wall = walls(item);
  const n = GRID * GRID;
  const labels = new Int32Array(n).fill(-2);
  const sizes: number[] = [];
  // A typed stack and the four neighbours written out: a million cells, so no small arrays per cell.
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (labels[start] !== -2) continue;
    if (wall[start]) {
      labels[start] = -1;
      continue;
    }
    const id = sizes.length;
    let size = 0;
    let top = 0;
    labels[start] = id;
    stack[top++] = start;
    while (top > 0) {
      const i = stack[--top];
      size++;
      const x = i % GRID;
      for (let k = 0; k < 4; k++) {
        const j = k === 0 ? (x > 0 ? i - 1 : -1) : k === 1 ? (x < GRID - 1 ? i + 1 : -1) : k === 2 ? i - GRID : i + GRID;
        if (j < 0 || j >= n || labels[j] !== -2) continue;
        if (wall[j]) labels[j] = -1;
        else {
          labels[j] = id;
          stack[top++] = j;
        }
      }
    }
    sizes.push(size);
  }
  const raw = realLines(item);
  const strips = raw ? reclaim(labels, sizes, raw) : undefined;
  return { labels, sizes, ...(strips ? { strips } : {}) };
}

/**
 * The lines as drawn — before they were thickened to close gaps — when the
 * picture keeps them, plus any lines drawn on top. Null for an item with no
 * picture, an older picture, or one the magic pen redrew (its strokes are the lines).
 */
function realLines(item: Pick<TraceItem, "strokes" | "paint">): Uint8Array | null {
  const picture = item.paint?.picture;
  if (!picture?.raw || picture.smooth) return null;
  const raw = unpackMask(picture.raw).slice();
  if (item.strokes.length) {
    const drawn = walls({ strokes: item.strokes });
    for (let i = 0; i < raw.length; i++) if (drawn[i]) raw[i] = 1;
  }
  return raw;
}

/**
 * Give back to the parts every cell the thickened lines took that is not under
 * a real line. Lines are thickened so a small break cannot let colour leak from
 * one part to the next — but where two lines run close together, the strip
 * between them was swallowed whole and could never be painted. So: each such
 * cell joins the part beside it (spreading only through unlined cells, never
 * across a real line), and a strip closed in on both sides becomes a small part
 * of its own. Every white pixel ends up paintable.
 */
function reclaim(labels: Int32Array, sizes: number[], raw: Uint8Array): Set<number> {
  const strips = new Set<number>();
  const n = labels.length;
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) if (labels[i] >= 0) queue[tail++] = i;
  const near = (i: number, k: number) => {
    const x = i % GRID;
    return k === 0 ? (x > 0 ? i - 1 : -1) : k === 1 ? (x < GRID - 1 ? i + 1 : -1) : k === 2 ? i - GRID : i + GRID;
  };
  // 1. Grow each part into the swallowed cells beside it, as far as the real lines.
  while (head < tail) {
    const i = queue[head++];
    for (let k = 0; k < 4; k++) {
      const j = near(i, k);
      if (j < 0 || j >= n || labels[j] !== -1 || raw[j]) continue;
      labels[j] = labels[i];
      sizes[labels[i]]++;
      queue[tail++] = j;
    }
  }
  // 2. What is left was walled in on every side: each run of it is a part of its own.
  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1 || raw[start]) continue;
    const id = sizes.length;
    let size = 0;
    head = tail = 0;
    labels[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      size++;
      for (let k = 0; k < 4; k++) {
      const j = near(i, k);
        if (j < 0 || j >= n || labels[j] !== -1 || raw[j]) continue;
        labels[j] = id;
        queue[tail++] = j;
      }
    }
    strips.add(id);
    sizes.push(size);
  }
  return strips;
}

/** How far (units) a tap on a line looks for the part beside it: more than half the thickest line. */
const NEAR = 14;

/** The area under a point — the nearest one within a few units when the point is on a line. -1 when none. */
export function areaAt(areas: Areas, p: Point): number {
  const cx = cellOf(p.x);
  const cy = cellOf(p.y);
  for (let r = 0; r <= Math.ceil(NEAR / CELL); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        const l = areas.labels[y * GRID + x];
        if (l >= 0) return l;
      }
    }
  }
  return -1;
}

/**
 * Per cell, the cell whose paint it shows: itself inside a part; for a line
 * cell or a speck, the nearest cell of a real part, however thick the line
 * (a breadth-first walk out from every part at once). Each side of a line
 * takes its own side's colour, so paint never shows across a border, and a
 * band of sketchy lines merged together fills from both sides.
 */
export function seamSources(areas: Areas): Int32Array {
  const n = areas.labels.length;
  const out = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    const l = areas.labels[i];
    if (l >= 0 && areas.sizes[l] >= SPECK) {
      out[i] = i;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % GRID;
    for (let k = 0; k < 4; k++) {
      const j = k === 0 ? (x > 0 ? i - 1 : -1) : k === 1 ? (x < GRID - 1 ? i + 1 : -1) : k === 2 ? i - GRID : i + GRID;
      if (j < 0 || j >= n || out[j] >= 0) continue;
      out[j] = out[i];
      queue[tail++] = j;
    }
  }
  return out;
}

export const stepAreas = (areas: Areas, step: Pick<PaintStep, "seeds">): Set<number> =>
  new Set(step.seeds.map((s) => areaAt(areas, s)).filter((l) => l >= 0));

/** Which step owns each area (the first, when two claim it); -1 = an area meant to stay white. */
export function owners(areas: Areas, steps: readonly Pick<PaintStep, "seeds">[]): Int32Array {
  const own = new Int32Array(areas.sizes.length).fill(-1);
  steps.forEach((s, k) => stepAreas(areas, s).forEach((l) => own[l] === -1 && (own[l] = k)));
  return own;
}

/* ---------------------------------------------------------------- paint */

/** The child's painting: a crayon index (1-based) per cell, 0 = white. */
export const blankPaint = () => new Uint8Array(GRID * GRID);

/**
 * Paint (or with crayon 0, rub out) a brush stroke from `a` to `b`.
 * `allowed`, when given, keeps the paint inside those areas — "stay inside the lines".
 * Line cells are never painted: the line art covers them.
 */
export function brush(paint: Uint8Array, areas: Areas, a: Point, b: Point, r: number, crayon: number, allowed?: Set<number>) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
  const rc = r / CELL;
  for (let k = 0; k <= n; k++) {
    const cx = (a.x + ((b.x - a.x) * k) / n) / CELL;
    const cy = (a.y + ((b.y - a.y) * k) / n) / CELL;
    for (let y = Math.max(0, Math.floor(cy - rc)); y <= Math.min(GRID - 1, Math.ceil(cy + rc)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rc)); x <= Math.min(GRID - 1, Math.ceil(cx + rc)); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > rc * rc) continue;
        const i = y * GRID + x;
        const l = areas.labels[i];
        if (l < 0 || (allowed && !allowed.has(l))) continue;
        paint[i] = crayon;
      }
    }
  }
}

export interface StepState {
  /** Share of the step's areas painted in its crayon, 0–1. */
  cover: number;
  /** Share of the step's areas painted in another crayon. */
  wrong: number;
  /** The other crayon used most there, when any. */
  wrongCrayon: number;
  /** The least-coloured of the parts the step must have (its own share, 0–1): a whole sleeve left white shows here, however big the rest is. 1 when it names none. */
  weakest: number;
}

/**
 * How a step is going. `required` are the parts it must have coloured — by
 * default every part it names bigger than a speck. With `anyColour` (the child
 * chose their own colours), every colour counts as right.
 */
export function stepState(paint: Uint8Array, areas: Areas, step: PaintStep, anyColour = false, required?: Set<number>): StepState {
  const own = stepAreas(areas, step);
  const must = required ?? new Set([...own].filter((l) => areas.sizes[l] >= SPECK));
  const want = crayonIndex(step.color);
  let total = 0;
  let right = 0;
  const others = new Map<number, number>();
  const perPart = new Map<number, number>();
  for (const l of own) total += areas.sizes[l];
  if (total === 0) return { cover: 0, wrong: 0, wrongCrayon: 0, weakest: 0 };
  for (let i = 0; i < paint.length; i++) {
    const c = paint[i];
    if (!c) continue;
    const l = areas.labels[i];
    if (!own.has(l)) continue;
    if (c === want || anyColour) {
      right++;
      if (must.has(l)) perPart.set(l, (perPart.get(l) ?? 0) + 1);
    } else others.set(c, (others.get(c) ?? 0) + 1);
  }
  let weakest = 1;
  for (const l of must) if (own.has(l)) weakest = Math.min(weakest, (perPart.get(l) ?? 0) / areas.sizes[l]);
  let wrongCrayon = 0;
  let most = 0;
  let wrong = 0;
  for (const [c, n] of others) {
    wrong += n;
    if (n > most) [most, wrongCrayon] = [n, c];
  }
  return { cover: right / total, wrong: wrong / total, wrongCrayon, weakest };
}

/** Each part a step names must be at least this coloured for the step to be complete — so a small part left white is never hidden by a big one done. */
export const PART_DONE = 0.5;
/** …and at least this begun before the child may say Done. */
export const PART_STARTED = 0.25;

/** The step is complete: coloured past the bar overall, and no part of it left behind. */
export const isComplete = (st: StepState, need: number) => st.cover >= need && st.weakest >= PART_DONE;
/** The child may finish it with Done: half coloured overall, and every part at least begun. */
export const maySayDone = (st: StepState) => st.cover >= NEARLY && st.weakest >= PART_STARTED;

/** How much of a step must be coloured, by the item's sensitivity. */
export const COVER: Record<TraceItem["sensitivity"], number> = { relaxed: 0.7, balanced: 0.8, strict: 0.9 };
/** A child who says a step is done after colouring at least this much gets its last gaps filled for them. */
export const NEARLY = 0.5;

export interface PaintScore {
  /** 0–100: right cells over (everything the steps ask for + every wrong-coloured cell there). Extra parts do not count. */
  accuracy: number;
  /** Share of the colouring areas filled at all, 0–1. */
  filled: number;
  /** Of what was painted inside the colouring areas, the share in the right crayon. */
  colors: number;
  stars: 0 | 1 | 2 | 3;
  /** The child coloured in their own colours: colour was not scored. */
  ownColours?: boolean;
}

/** The whole painting, scored when the child says they are done. */
/** With `anyColour`, the child chose their own colours: filled and inside the lines are scored, the colours are not. */
export function scorePainting(paint: Uint8Array, areas: Areas, steps: readonly PaintStep[], anyColour = false): PaintScore {
  const own = owners(areas, steps);
  const want = steps.map((s) => crayonIndex(s.color));
  let target = 0;
  for (let l = 0; l < own.length; l++) if (own[l] >= 0) target += areas.sizes[l];
  let right = 0;
  let wrongIn = 0;
  let extra = 0;
  for (let i = 0; i < paint.length; i++) {
    const c = paint[i];
    if (!c) continue;
    const l = areas.labels[i];
    if (l < 0) continue;
    const k = own[l];
    // A part no step asks for is the child's to colour as they like: it is never marked down.
    if (k < 0) extra++;
    else if (c === want[k] || anyColour) right++;
    else wrongIn++;
  }
  const painted = right + wrongIn + extra;
  const accuracy = target === 0 ? 0 : Math.round((100 * right) / (target + wrongIn));
  const stars = painted === 0 ? 0 : accuracy >= 85 ? 3 : accuracy >= 60 ? 2 : 1;
  return {
    accuracy,
    filled: target === 0 ? 0 : (right + wrongIn) / target,
    colors: right + wrongIn === 0 ? 0 : right / (right + wrongIn),
    stars,
    ...(anyColour ? { ownColours: true } : {}),
  };
}
