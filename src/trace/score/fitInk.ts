/**
 * Writing with no guide (copy, memory): the child's letter can be anywhere on
 * the grid, at any size. Before strokes are compared, move and resize the ink
 * onto the target — within limits, so a squashed or tilted letter still
 * looks squashed or tilted to the scorer.
 */

import { bounds, centroid } from "../geometry/polyline";
import type { Point } from "../geometry/types";
import { dist } from "../geometry/vec";

export interface FitLimits {
  /** ± degrees of rotation to try. */
  rotation?: number;
  /** ± fraction the aspect may drift (0.25 = 0.8×…1.25×). */
  aspect?: number;
  /** Allowed uniform scale range. */
  scale?: [number, number];
  /** Furthest the ink may be moved, in units. */
  shift?: number;
}

export interface Transform {
  /** Ink centroid, the pivot. */
  from: Point;
  /** Where the pivot lands. */
  to: Point;
  scale: number;
  aspect: number;
  rotation: number;
}

export const IDENTITY: Transform = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, scale: 1, aspect: 1, rotation: 0 };

export function applyTransform(p: Point, t: Transform): Point {
  const sx = t.scale * Math.sqrt(t.aspect);
  const sy = t.scale / Math.sqrt(t.aspect);
  const x = (p.x - t.from.x) * sx;
  const y = (p.y - t.from.y) * sy;
  const r = (t.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: t.to.x + x * c - y * s, y: t.to.y + x * s + y * c };
}

/** Mean distance of each point to the nearest point of the other set, both ways. */
function chamfer(a: Point[], b: Point[]): number {
  const oneWay = (from: Point[], to: Point[]) => {
    let total = 0;
    for (const p of from) {
      let best = Infinity;
      for (const q of to) {
        const d = dist(p, q);
        if (d < best) best = d;
      }
      total += best;
    }
    return total / Math.max(1, from.length);
  };
  return (oneWay(a, b) + oneWay(b, a)) / 2;
}

const diagonal = (groups: Point[][]) => {
  const b = bounds(groups);
  return Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
};

/**
 * The transform (within `limits`) that lays `ink` best over `target`. Both are
 * sampled point clouds (resample first). Returns the transform and its cost.
 */
export function fitInk(ink: Point[][], target: Point[][], limits: FitLimits = {}): { transform: Transform; cost: number } {
  const { rotation = 10, aspect = 0.25, scale: scaleRange = [0.2, 5], shift = Infinity } = limits;
  const inkPoints = ink.flat();
  const targetPoints = target.flat();
  if (inkPoints.length === 0 || targetPoints.length === 0) return { transform: IDENTITY, cost: Infinity };

  const from = centroid(ink);
  const aim = centroid(target);
  const shifted = dist(from, aim) > shift ? { x: from.x + ((aim.x - from.x) * shift) / dist(from, aim), y: from.y + ((aim.y - from.y) * shift) / dist(from, aim) } : aim;
  const inkDiag = diagonal(ink);
  const baseScale = inkDiag === 0 ? 1 : Math.min(scaleRange[1], Math.max(scaleRange[0], diagonal(target) / inkDiag));

  const cost = (t: Transform) => chamfer(inkPoints.map((p) => applyTransform(p, t)), targetPoints);

  let best: Transform = { from, to: shifted, scale: baseScale, aspect: 1, rotation: 0 };
  let bestCost = cost(best);

  const rotations = rotation > 0 ? [-rotation, -rotation / 2, 0, rotation / 2, rotation] : [0];
  const aspects = aspect > 0 ? [1 / (1 + aspect), 1 / (1 + aspect / 2), 1, 1 + aspect / 2, 1 + aspect] : [1];
  for (const r of rotations) {
    for (const a of aspects) {
      const t = { ...best, rotation: r, aspect: a };
      const c = cost(t);
      if (c < bestCost) {
        best = t;
        bestCost = c;
      }
    }
  }

  // Refine: coordinate descent on position, scale, aspect and rotation with shrinking steps.
  const clampShift = (to: Point) => {
    const d = dist(from, to);
    return d <= shift ? to : { x: from.x + ((to.x - from.x) * shift) / d, y: from.y + ((to.y - from.y) * shift) / d };
  };
  let step = { move: 40, scale: 0.08, aspect: 0.06, rotation: rotation / 4 };
  for (let round = 0; round < 6; round++) {
    let improved = true;
    while (improved) {
      improved = false;
      const tries: Transform[] = [
        { ...best, to: clampShift({ x: best.to.x + step.move, y: best.to.y }) },
        { ...best, to: clampShift({ x: best.to.x - step.move, y: best.to.y }) },
        { ...best, to: clampShift({ x: best.to.x, y: best.to.y + step.move }) },
        { ...best, to: clampShift({ x: best.to.x, y: best.to.y - step.move }) },
        { ...best, scale: Math.min(scaleRange[1], best.scale * (1 + step.scale)) },
        { ...best, scale: Math.max(scaleRange[0], best.scale / (1 + step.scale)) },
      ];
      if (aspect > 0) {
        tries.push({ ...best, aspect: Math.min(1 + aspect, best.aspect * (1 + step.aspect)) });
        tries.push({ ...best, aspect: Math.max(1 / (1 + aspect), best.aspect / (1 + step.aspect)) });
      }
      if (rotation > 0) {
        tries.push({ ...best, rotation: Math.min(rotation, best.rotation + step.rotation) });
        tries.push({ ...best, rotation: Math.max(-rotation, best.rotation - step.rotation) });
      }
      for (const t of tries) {
        const c = cost(t);
        if (c < bestCost - 1e-6) {
          best = t;
          bestCost = c;
          improved = true;
        }
      }
    }
    step = { move: step.move / 2, scale: step.scale / 2, aspect: step.aspect / 2, rotation: step.rotation / 2 };
  }
  return { transform: best, cost: bestCost };
}
