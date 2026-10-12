/**
 * Soft gradient colours: each part a child colours is shaded top to bottom —
 * a little lighter at its top, a little deeper at its bottom — like a modern
 * children's illustration. The child still just picks a crayon; the shading
 * follows each part's own shape, so a star is lit from its top point down.
 */

import { GRID } from "./grid";
import type { Areas } from "./areas";

/** How much lighter a part's top is (towards white), and how much deeper its bottom. */
const LIGHT = 0.32;
const DEEP = 0.14;

/** Each part's top and bottom row, so a cell knows where it sits within its part. */
export function partSpans(areas: Areas): { top: Int32Array; bottom: Int32Array } {
  const top = new Int32Array(areas.sizes.length).fill(GRID);
  const bottom = new Int32Array(areas.sizes.length).fill(-1);
  const { labels } = areas;
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (l < 0) continue;
    const y = (i / GRID) | 0;
    if (y < top[l]) top[l] = y;
    if (y > bottom[l]) bottom[l] = y;
  }
  return { top, bottom };
}

/** A colour at `t` down its part (0 = top, 1 = bottom). */
export function shade([r, g, b]: readonly number[], t: number): [number, number, number] {
  const lift = LIGHT * (1 - t);
  const keep = 1 - DEEP * t;
  const f = (c: number) => Math.round((c + (255 - c) * lift) * keep);
  return [f(r), f(g), f(b)];
}

/** Where cell `i` sits down its part, 0–1. `label` is its part (a line cell borrows its side's). */
export function depthIn(spans: { top: Int32Array; bottom: Int32Array }, label: number, i: number): number {
  if (label < 0) return 0.5;
  const h = spans.bottom[label] - spans.top[label];
  return h > 0 ? Math.min(1, Math.max(0, ((i / GRID) | 0) - spans.top[label]) / h) : 0.5;
}
