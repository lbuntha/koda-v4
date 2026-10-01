/**
 * Raw pointer ink → clean strokes the scorer can compare.
 *
 * Scoring always uses this ink, never what the screen drew: assist may pull
 * the drawn line toward the band, but the measure is what the hand did.
 */

import type { Point } from "../geometry/types";
import { dist } from "../geometry/vec";

export interface InkPoint extends Point {
  /** Milliseconds, any origin. */
  t: number;
}

export interface CaptureOptions {
  /** Points closer than this to the last kept one are dropped. */
  minStep?: number;
  /** A lift shorter than this that restarts nearby is a wobble, not a new stroke. */
  mergeGapMs?: number;
  mergeDistance?: number;
}

export function cleanInk(strokes: InkPoint[][], { minStep = 2, mergeGapMs = 200, mergeDistance = 40 }: CaptureOptions = {}): Point[][] {
  // Merge wobble lifts first, while timestamps are still there.
  const merged: InkPoint[][] = [];
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last) {
      const end = last[last.length - 1];
      const start = stroke[0];
      if (start.t - end.t < mergeGapMs && dist(start, end) <= mergeDistance) {
        last.push(...stroke);
        continue;
      }
    }
    merged.push([...stroke]);
  }

  return merged.map((stroke) => {
    const kept: Point[] = [];
    for (const p of stroke) {
      if (kept.length === 0 || dist(kept[kept.length - 1], p) >= minStep) kept.push({ x: p.x, y: p.y });
    }
    const lastRaw = stroke[stroke.length - 1];
    if (kept.length > 0 && dist(kept[kept.length - 1], lastRaw) > 0) kept.push({ x: lastRaw.x, y: lastRaw.y });
    return smooth(kept);
  });
}

/** Moving average over 3, ends kept exactly. */
function smooth(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    out.push({ x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3, y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3 });
  }
  out.push(points[points.length - 1]);
  return out;
}
