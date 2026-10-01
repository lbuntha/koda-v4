/**
 * Where each stroke's number badge sits. An admin can drag a badge (stored
 * as an offset from the stroke's start); a badge nobody placed goes up-left
 * of its start, and steps around it when that spot would cover another
 * badge — two strokes that start at the same point get two readable numbers.
 */

import type { Point, Stroke } from "./types";
import { dist } from "./vec";

export const BADGE_OFFSET = { dx: -34, dy: -34 };
/** Two badges closer than this overlap. */
const CLEAR = 52;

/** Places to try, in order, around the start (up-left first, then clockwise). */
const AROUND = [
  [-34, -34],
  [34, -34],
  [-34, 34],
  [34, 34],
  [0, -48],
  [-48, 0],
  [48, 0],
  [0, 48],
  [-68, -68],
  [68, -68],
];

export function badgeCenters(strokes: Stroke[]): Point[] {
  const sorted = [...strokes].sort((a, b) => a.order - b.order);
  const placed: Point[] = [];
  const byId = new Map<string, Point>();
  // Badges the admin placed are fixed; the rest fit around them.
  for (const s of sorted) {
    const start = s.nodes[0];
    if (!start || !s.badge) continue;
    const c = { x: start.x + s.badge.dx, y: start.y + s.badge.dy };
    placed.push(c);
    byId.set(s.id, c);
  }
  for (const s of sorted) {
    const start = s.nodes[0];
    if (!start || s.badge) continue;
    const options = AROUND.map(([dx, dy]) => ({ x: start.x + dx, y: start.y + dy }));
    const c = options.find((o) => placed.every((p) => dist(p, o) >= CLEAR) && o.x >= 20 && o.y >= 20 && o.x <= 980 && o.y <= 980) ?? options[0];
    placed.push(c);
    byId.set(s.id, c);
  }
  return strokes.map((s) => byId.get(s.id) ?? { x: (s.nodes[0]?.x ?? 0) + BADGE_OFFSET.dx, y: (s.nodes[0]?.y ?? 0) + BADGE_OFFSET.dy });
}
