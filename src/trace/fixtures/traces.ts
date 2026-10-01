/**
 * Synthetic ink for the golden set: ideal, wobbly, reversed, half, scribbled,
 * moved. Seeded, so every run is the same.
 *
 * These stand in for real children's traces until the Phase 1 player can
 * record them; recorded traces are then added beside these, not instead.
 */

import { strokePolyline } from "../geometry/bezier";
import { pointAt, resample, track } from "../geometry/polyline";
import type { Point, Stroke, TraceItem } from "../geometry/types";
import { normal, sub } from "../geometry/vec";
import type { InkPoint } from "../score/capture";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ordered = (item: TraceItem) => [...item.strokes].sort((a, b) => a.order - b.order);

/** Exactly on the stroke. */
export function ideal(stroke: Stroke, step = 6): Point[] {
  const poly = strokePolyline(stroke);
  return poly.length === 1 ? [poly[0]] : resample(poly, step);
}

export const idealAll = (item: TraceItem) => ordered(item).map((s) => ideal(s));

/** Sideways waves of about `amp` units, like an unsteady hand. */
export function wobble(points: Point[], amp: number, seed: number): Point[] {
  if (points.length < 2) return points;
  const r = rng(seed);
  const t = track(points);
  const f1 = 2 + r();
  const f2 = 5 + 2 * r();
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const n = normal(sub(b, a));
    const u = t.length === 0 ? 0 : t.cum[i] / t.length;
    const off = amp * (0.6 * Math.sin(2 * Math.PI * f1 * u + p1) + 0.4 * Math.sin(2 * Math.PI * f2 * u + p2));
    return { x: p.x + n.x * off, y: p.y + n.y * off };
  });
}

export const wobbleAll = (item: TraceItem, amp: number, seed = 1) => idealAll(item).map((s, i) => wobble(s, amp, seed + i));

export const reversed = (points: Point[]) => [...points].reverse();

/** The part of the ink from `from` to `to` (fractions of its length). */
export function part(points: Point[], from: number, to: number, step = 6): Point[] {
  const t = track(points);
  const out: Point[] = [];
  const a = from * t.length;
  const b = to * t.length;
  for (let s = a; s < b; s += step) out.push(pointAt(t, s));
  out.push(pointAt(t, b));
  return out;
}

/** Back and forth along the stroke. */
export function scribble(points: Point[], passes = 5): Point[] {
  const out: Point[] = [];
  for (let k = 0; k < passes; k++) out.push(...(k % 2 === 0 ? points : reversed(points)));
  return out;
}

/** Resize, rotate and move a whole drawing about the canvas centre. */
export function moved(strokes: Point[][], { scale = 1, dx = 0, dy = 0, rotation = 0 } = {}): Point[][] {
  const r = (rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return strokes.map((stroke) =>
    stroke.map((p) => {
      const x = (p.x - 500) * scale;
      const y = (p.y - 500) * scale;
      return { x: 500 + x * c - y * s + dx, y: 500 + x * s + y * c + dy };
    }),
  );
}

/** As pointer events, `dt` ms apart, strokes `gap` ms apart. */
export function timed(strokes: Point[][], dt = 10, gap = 400): InkPoint[][] {
  let t = 0;
  return strokes.map((stroke) => {
    const out = stroke.map((p) => ({ ...p, t: (t += dt) }));
    t += gap;
    return out;
  });
}
