/**
 * From a picture to stroke pieces — the free half of starter strokes.
 *
 * A black-and-white mask of the guide (a typed letter or an uploaded picture)
 * is thinned to a one-pixel centre line (Zhang–Suen), the centre line is split
 * into pieces at its ends and crossings, tiny spurs are dropped, and each piece
 * is fitted to cubic Béziers — editable strokes. Deterministic, on the device,
 * no AI. Ordering the pieces into strokes a child is taught to write is the
 * other half (reading order here; the AI, for paid creators).
 */

import { fitNodes } from "./fit";
import { polylineLength } from "./polyline";
import type { Point, Stroke } from "./types";
import { dist } from "./vec";

export interface Mask {
  w: number;
  h: number;
  /** 1 = ink, row by row. */
  on: Uint8Array;
}

const at = (m: Mask, x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.on[y * m.w + x]);

/* Neighbours clockwise from north: P2..P9 in Zhang–Suen's naming. */
const RING: [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** Zhang–Suen thinning: ink down to a one-pixel centre line, keeping its shape and connections. */
export function thin(input: Mask): Mask {
  const m: Mask = { w: input.w, h: input.h, on: Uint8Array.from(input.on) };
  let changed = true;
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      const remove: number[] = [];
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          if (!at(m, x, y)) continue;
          const p = RING.map(([dx, dy]) => at(m, x + dx, y + dy));
          const b = p.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) a++;
          if (a !== 1) continue;
          // P2·P4·P6 and P4·P6·P8 (pass 0); P2·P4·P8 and P2·P6·P8 (pass 1).
          const [p2, , p4, , p6, , p8] = p;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          remove.push(y * m.w + x);
        }
      }
      for (const i of remove) m.on[i] = 0;
      if (remove.length) changed = true;
    }
  }
  return m;
}

/** 0→1 transitions around a pixel: 1 at a line end, 2 along a line, 3+ where lines meet. */
function crossings(m: Mask, x: number, y: number): number {
  const p = RING.map(([dx, dy]) => at(m, x + dx, y + dy));
  let n = 0;
  for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) n++;
  return n;
}

function neighbours(m: Mask, x: number, y: number): [number, number][] {
  // Straight neighbours first, so a walk follows the line instead of cutting its corners.
  const order = [0, 2, 4, 6, 1, 3, 5, 7];
  return order.flatMap((i) => {
    const [dx, dy] = RING[i];
    return at(m, x + dx, y + dy) ? [[x + dx, y + dy] as [number, number]] : [];
  });
}

interface Path {
  points: Point[];
  /** Node ids at each end (-1 = a free line end); a closed loop has none. */
  from: number;
  to: number;
  closed: boolean;
}

/** The centre line as paths between ends and crossings, plus closed loops. */
export function skeletonPaths(sk: Mask): Path[] {
  const key = (x: number, y: number) => y * sk.w + x;
  // Crossing pixels next to each other are one crossing.
  const isNode = new Map<number, number>(); // pixel → node id
  const nodeAt: Point[] = [];
  const kinds: number[] = [];
  for (let y = 0; y < sk.h; y++) {
    for (let x = 0; x < sk.w; x++) {
      if (!at(sk, x, y)) continue;
      // By transitions around the pixel, not by neighbour count: a thinned
      // curve's staircase corners have three or four neighbours but are still
      // just a line (two transitions).
      const c = crossings(sk, x, y);
      const deg = neighbours(sk, x, y).length;
      if (c === 1 || c >= 3 || deg === 1) kinds[key(x, y)] = c >= 3 ? 3 : 1;
    }
  }
  // Group node pixels into nodes.
  const seen = new Set<number>();
  for (const k in kinds) {
    const start = Number(k);
    if (seen.has(start)) continue;
    const id = nodeAt.length;
    const stack = [start];
    const members: Point[] = [];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop()!;
      const cx = cur % sk.w;
      const cy = Math.floor(cur / sk.w);
      isNode.set(cur, id);
      members.push({ x: cx, y: cy });
      for (const [nx, ny] of neighbours(sk, cx, cy)) {
        const nk = key(nx, ny);
        if (kinds[nk] !== undefined && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    nodeAt.push({ x: members.reduce((a, p) => a + p.x, 0) / members.length, y: members.reduce((a, p) => a + p.y, 0) / members.length });
  }

  const used = new Set<number>(); // non-node pixels already in a path
  const paths: Path[] = [];
  for (const [pk, id] of isNode) {
    const px = pk % sk.w;
    const py = Math.floor(pk / sk.w);
    for (const [sx, sy] of neighbours(sk, px, py)) {
      const sk0 = key(sx, sy);
      if (isNode.has(sk0) || used.has(sk0)) {
        // Two crossings side by side with nothing between: no path.
        continue;
      }
      const pts: Point[] = [nodeAt[id], { x: sx, y: sy }];
      used.add(sk0);
      let cx = sx;
      let cy = sy;
      let end = -1;
      for (;;) {
        const next = neighbours(sk, cx, cy).find(([nx, ny]) => {
          const nk = key(nx, ny);
          return !used.has(nk) && !(isNode.get(nk) === id && pts.length < 3);
        });
        if (!next) break;
        const nk = key(next[0], next[1]);
        if (isNode.has(nk)) {
          end = isNode.get(nk)!;
          pts.push(nodeAt[end]);
          break;
        }
        used.add(nk);
        pts.push({ x: next[0], y: next[1] });
        cx = next[0];
        cy = next[1];
      }
      // A walk that comes straight back to its own crossing in a few pixels is a
      // knot in the thinning, not a loop someone drew.
      if (end === id && pts.length < 8) continue;
      paths.push({ points: pts, from: id, to: end, closed: end === id });
    }
  }
  // Loops with no end or crossing anywhere (an "o").
  for (let y = 0; y < sk.h; y++) {
    for (let x = 0; x < sk.w; x++) {
      const k = key(x, y);
      if (!at(sk, x, y) || used.has(k) || isNode.has(k)) continue;
      const pts: Point[] = [{ x, y }];
      used.add(k);
      let cx = x;
      let cy = y;
      for (;;) {
        const next = neighbours(sk, cx, cy).find(([nx, ny]) => !used.has(key(nx, ny)));
        if (!next) break;
        used.add(key(next[0], next[1]));
        pts.push({ x: next[0], y: next[1] });
        cx = next[0];
        cy = next[1];
      }
      if (pts.length > 4) paths.push({ points: pts, from: -1, to: -1, closed: true });
    }
  }
  return paths;
}

/** Drop short spurs that stick out of a crossing, then rejoin lines the spur had split. */
function prune(paths: Path[], minSpur: number): Path[] {
  let list = paths.filter((p) => p.closed || polylineLength(p.points) >= 2);
  for (;;) {
    const ends = new Map<number, number>();
    for (const p of list) for (const n of [p.from, p.to]) if (n >= 0) ends.set(n, (ends.get(n) ?? 0) + 1);
    const spur = list.find((p) => !p.closed && (p.from < 0 || p.to < 0) && (p.from >= 0 || p.to >= 0) && (ends.get(p.from >= 0 ? p.from : p.to) ?? 0) >= 3 && polylineLength(p.points) < minSpur);
    if (!spur) break;
    list = list.filter((p) => p !== spur);
  }
  // A crossing left with exactly two lines is not a crossing: join them.
  for (;;) {
    const ends = new Map<number, Path[]>();
    for (const p of list) for (const n of [p.from, p.to]) if (n >= 0) ends.set(n, [...(ends.get(n) ?? []), p]);
    const join = [...ends.entries()].find(([, ps]) => ps.length === 2 && ps[0] !== ps[1]);
    if (!join) break;
    const [node, [a, b]] = join;
    const aPts = a.to === node ? a.points : [...a.points].reverse();
    const bPts = b.from === node ? b.points : [...b.points].reverse();
    const aFar = a.to === node ? a.from : a.to;
    const bFar = b.from === node ? b.to : b.from;
    const merged: Path = { points: [...aPts, ...bPts.slice(1)], from: aFar, to: bFar, closed: aFar === bFar && aFar >= 0 };
    list = [...list.filter((p) => p !== a && p !== b), merged];
  }
  return list;
}

function smooth(points: Point[], passes = 2): Point[] {
  let pts = points;
  for (let k = 0; k < passes; k++) {
    if (pts.length < 3) return pts;
    pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : { x: (pts[i - 1].x + p.x + pts[i + 1].x) / 3, y: (pts[i - 1].y + p.y + pts[i + 1].y) / 3 }));
  }
  return pts;
}

/** A piece of centre line, in canvas units (0–1000). */
export interface Piece {
  id: number;
  points: Point[];
  closed: boolean;
}

export interface VectorizeOptions {
  /** Shortest spur kept, as a share of the drawing's size. */
  minSpur?: number;
  /** Shortest piece kept at all, in canvas units. */
  minLength?: number;
}

/** A mask (any size) → centre-line pieces in 0–1000 units. */
export function pieces(mask: Mask, { minSpur = 0.06, minLength = 25 }: VectorizeOptions = {}): Piece[] {
  const sk = thin(mask);
  const scale = 1000 / Math.max(mask.w, mask.h);
  const raw = prune(skeletonPaths(sk), (minSpur * 1000) / scale);
  return raw
    .map((p) => smooth(p.points).map((q) => ({ x: (q.x + 0.5) * scale, y: (q.y + 0.5) * scale })))
    .map((points, i) => ({ id: i, points, closed: raw[i].closed }))
    .filter((p) => polylineLength(p.points) >= minLength)
    .map((p, i) => ({ ...p, id: i + 1 }));
}

/* ------------------------------------------------- pieces → strokes */

export interface StrokePlanEntry {
  pieces: { id: number; reverse: boolean }[];
  /** Pen up before this stroke (default) or carry on from the last one. */
  lift?: boolean;
}

/**
 * The order with no AI: top to bottom, then left to right, each piece drawn
 * from its upper (then left) end — how most handwriting is taught to start.
 */
export function readingOrder(list: Piece[]): StrokePlanEntry[] {
  const first = (p: Piece) => {
    const a = p.points[0];
    const b = p.points[p.points.length - 1];
    const aFirst = Math.abs(a.y - b.y) > 40 ? a.y < b.y : a.x <= b.x;
    return { start: aFirst ? a : b, reverse: !aFirst };
  };
  return [...list]
    .map((p) => ({ p, ...first(p), top: Math.min(...p.points.map((q) => q.y)) }))
    .sort((u, v) => (Math.abs(u.top - v.top) > 80 ? u.top - v.top : u.start.x - v.start.x))
    .map(({ p, reverse }) => ({ pieces: [{ id: p.id, reverse: p.closed ? false : reverse }], lift: true }));
}

/**
 * Check an order (from the AI or anywhere else) against the pieces: unknown or
 * repeated ids are dropped, and pieces it forgot are added at the end in
 * reading order — so a careless answer still yields every stroke once.
 */
export function cleanPlan(plan: unknown, list: Piece[]): StrokePlanEntry[] {
  const ids = new Set(list.map((p) => p.id));
  const used = new Set<number>();
  const out: StrokePlanEntry[] = [];
  if (Array.isArray(plan)) {
    for (const entry of plan) {
      const raw = (entry as { pieces?: unknown })?.pieces;
      if (!Array.isArray(raw)) continue;
      const ps = raw.flatMap((r) => {
        const id = Number((r as { id?: unknown })?.id);
        if (!ids.has(id) || used.has(id)) return [];
        used.add(id);
        return [{ id, reverse: Boolean((r as { reverse?: unknown })?.reverse) }];
      });
      if (ps.length) out.push({ pieces: ps, lift: (entry as { lift?: unknown })?.lift !== false });
    }
  }
  const missing = list.filter((p) => !used.has(p.id));
  return [...out, ...readingOrder(missing)];
}

/** Turn an order of pieces into editable strokes, numbered in that order. */
export function strokesFromPlan(list: Piece[], plan: StrokePlanEntry[], newId: () => string, maxError = 7): Stroke[] {
  const byId = new Map(list.map((p) => [p.id, p]));
  return plan.map((entry, i) => {
    const pts: Point[] = [];
    let closed = false;
    for (const { id, reverse } of entry.pieces) {
      const p = byId.get(id)!;
      const seq = reverse ? [...p.points].reverse() : p.points;
      // Join pieces end to start; skip a duplicated meeting point.
      for (const q of seq) if (!pts.length || dist(pts[pts.length - 1], q) > 0.5) pts.push(q);
      closed = entry.pieces.length === 1 && p.closed;
    }
    const tiny = polylineLength(pts) < 30;
    const nodes = tiny ? [{ x: pts[0].x, y: pts[0].y, type: "corner" as const }] : fitNodes(closed ? pts.slice(0, -1) : pts, maxError);
    return {
      id: newId(),
      order: i + 1,
      shape: tiny ? "dot" : closed ? "loop" : nodes.length === 2 && !nodes[0].out && !nodes[1].in ? "line" : "free",
      nodes,
      closed: closed && !tiny,
      join: i > 0 && entry.lift === false ? "continue" : "lift",
      width: 60,
      ...(tiny ? { radius: 20 } : {}),
      checkpoints: [],
    } satisfies Stroke;
  });
}
