/**
 * Magic Snap: while the admin drags a node, pull it onto something meaningful
 * nearby. Priority: another stroke's end, then the guide's centre-line, then a
 * grid intersection; a straight segment also snaps to 0°/45°/90°.
 */

import type { Point } from "./types";
import { dist } from "./vec";

export type SnapKind = "end" | "guide" | "grid" | "angle" | "none";

export interface SnapTargets {
  /** Ends (and starts) of other strokes. */
  ends?: Point[];
  /** The guide's centre-line, sampled densely. */
  guide?: Point[];
  /** Grid spacing in units (intersections at multiples of it). */
  grid?: number;
  /** When drawing a straight segment from here, also snap its angle. */
  angleFrom?: Point;
}

export interface Snapped {
  point: Point;
  kind: SnapKind;
}

const ANGLE_STEP = Math.PI / 4;
const ANGLE_TOLERANCE = (6 * Math.PI) / 180;

function closest(p: Point, candidates: Point[] | undefined, radius: number): Point | undefined {
  let best: Point | undefined;
  let bestDist = radius;
  for (const c of candidates ?? []) {
    const d = dist(p, c);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

export function snapPoint(p: Point, targets: SnapTargets, radius = 18): Snapped {
  const end = closest(p, targets.ends, radius);
  if (end) return { point: { ...end }, kind: "end" };

  const guide = closest(p, targets.guide, radius);
  if (guide) return { point: { ...guide }, kind: "guide" };

  if (targets.grid && targets.grid > 0) {
    const g = targets.grid;
    const corner = { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
    if (dist(corner, p) <= radius) return { point: corner, kind: "grid" };
  }

  if (targets.angleFrom) {
    const o = targets.angleFrom;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / ANGLE_STEP) * ANGLE_STEP;
      if (Math.abs(angle - snapped) <= ANGLE_TOLERANCE) {
        return { point: { x: o.x + Math.cos(snapped) * length, y: o.y + Math.sin(snapped) * length }, kind: "angle" };
      }
    }
  }

  return { point: p, kind: "none" };
}
