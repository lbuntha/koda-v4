/**
 * Polylines: what both a target stroke and a child's ink become before they
 * are compared. A `Track` caches the cumulative length so arc positions and
 * nearest-point queries are cheap.
 */

import type { Point } from "./types";
import { dist, lerp } from "./vec";

export interface Track {
  points: Point[];
  /** cum[i] = length from points[0] to points[i]. */
  cum: number[];
  length: number;
}

export function track(points: Point[]): Track {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  return { points, cum, length: cum[cum.length - 1] ?? 0 };
}

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** The point `s` units along the track (clamped to its ends). */
export function pointAt(t: Track, s: number): Point {
  const { points, cum, length } = t;
  if (points.length === 0) return { x: 0, y: 0 };
  if (s <= 0 || points.length === 1) return points[0];
  if (s >= length) return points[points.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  return span === 0 ? points[lo] : lerp(points[lo], points[hi], (s - cum[lo]) / span);
}

/** Evenly spaced points `step` apart (the last gap absorbs the remainder); ends kept. */
export function resample(points: Point[], step: number): Point[] {
  if (points.length < 2) return points.slice();
  const t = track(points);
  if (t.length === 0) return [points[0]];
  const n = Math.max(1, Math.round(t.length / step));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) out.push(pointAt(t, (t.length * i) / n));
  return out;
}

export interface Nearest {
  dist: number;
  /** Arc position of the nearest point along the track. */
  s: number;
  point: Point;
}

export function nearest(t: Track, p: Point): Nearest {
  const { points, cum } = t;
  if (points.length === 1) return { dist: dist(points[0], p), s: 0, point: points[0] };
  let best: Nearest = { dist: Infinity, s: 0, point: points[0] };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let u = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const q = { x: a.x + dx * u, y: a.y + dy * u };
    const d = dist(q, p);
    if (d < best.dist) best = { dist: d, s: cum[i - 1] + (cum[i] - cum[i - 1]) * u, point: q };
  }
  return best;
}

/** Shoelace area, closing the polyline. On a y-down screen, positive = clockwise as seen. */
export function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(groups: Point[][]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const group of groups) {
    for (const p of group) {
      if (p.x < b.minX) b.minX = p.x;
      if (p.y < b.minY) b.minY = p.y;
      if (p.x > b.maxX) b.maxX = p.x;
      if (p.y > b.maxY) b.maxY = p.y;
    }
  }
  return b;
}

/** Mean of the points (not length-weighted — callers resample first). */
export function centroid(groups: Point[][]): Point {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const group of groups) {
    for (const p of group) {
      x += p.x;
      y += p.y;
      n++;
    }
  }
  return n === 0 ? { x: 0, y: 0 } : { x: x / n, y: y / n };
}
