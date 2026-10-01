/**
 * Cubic Bézier maths for strokes: turning nodes into segments, evaluating,
 * splitting and flattening them into polylines the scorer can measure.
 */

import type { Point, Stroke, TraceNode } from "./types";
import { dist, lerp } from "./vec";

export type Cubic = readonly [Point, Point, Point, Point];

export function nodeSegment(a: TraceNode, b: TraceNode): Cubic {
  const p0 = { x: a.x, y: a.y };
  const p3 = { x: b.x, y: b.y };
  const p1 = a.out ? { x: a.x + a.out.dx, y: a.y + a.out.dy } : p0;
  const p2 = b.in ? { x: b.x + b.in.dx, y: b.y + b.in.dy } : p3;
  return [p0, p1, p2, p3];
}

/** A closed stroke's last segment runs from the last node back to the first. */
export function strokeSegments(stroke: Pick<Stroke, "nodes" | "closed">): Cubic[] {
  const { nodes } = stroke;
  const segments: Cubic[] = [];
  for (let i = 0; i < nodes.length - 1; i++) segments.push(nodeSegment(nodes[i], nodes[i + 1]));
  if (stroke.closed && nodes.length > 1) segments.push(nodeSegment(nodes[nodes.length - 1], nodes[0]));
  return segments;
}

export function evalCubic(c: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

/** First derivative (tangent, not normalised). */
export function derivCubic(c: Cubic, t: number): Point {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const d = 3 * t * t;
  return {
    x: a * (c[1].x - c[0].x) + b * (c[2].x - c[1].x) + d * (c[3].x - c[2].x),
    y: a * (c[1].y - c[0].y) + b * (c[2].y - c[1].y) + d * (c[3].y - c[2].y),
  };
}

/** de Casteljau: two cubics that together draw exactly the original. */
export function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const p01 = lerp(c[0], c[1], t);
  const p12 = lerp(c[1], c[2], t);
  const p23 = lerp(c[2], c[3], t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const mid = lerp(p012, p123, t);
  return [
    [c[0], p01, p012, mid],
    [mid, p123, p23, c[3]],
  ];
}

function pointToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  if (l === 0) return dist(p, a);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l;
}

/**
 * The cubic as a polyline within `tolerance` units, start and end included.
 * Adaptive: straight parts cost two points, tight curls get many.
 */
export function flattenCubic(c: Cubic, tolerance = 0.25): Point[] {
  const out: Point[] = [c[0]];
  const walk = (seg: Cubic, depth: number) => {
    const flat = Math.max(pointToLine(seg[1], seg[0], seg[3]), pointToLine(seg[2], seg[0], seg[3])) <= tolerance;
    // A chord-length check too: handles pulled back along the chord are "flat" but not evenly timed.
    const short = dist(seg[0], seg[3]) <= 64;
    if ((flat && short) || depth >= 16) {
      out.push(seg[3]);
      return;
    }
    const [a, b] = splitCubic(seg, 0.5);
    walk(a, depth + 1);
    walk(b, depth + 1);
  };
  walk(c, 0);
  return out;
}

/** The whole stroke as one polyline. A dot is its single node. */
export function strokePolyline(stroke: Pick<Stroke, "nodes" | "closed">, tolerance = 0.25): Point[] {
  if (stroke.nodes.length === 0) return [];
  const first = stroke.nodes[0];
  const points: Point[] = [{ x: first.x, y: first.y }];
  for (const segment of strokeSegments(stroke)) {
    const flat = flattenCubic(segment, tolerance);
    for (let i = 1; i < flat.length; i++) {
      if (dist(flat[i], points[points.length - 1]) > 1e-9) points.push(flat[i]);
    }
  }
  return points;
}

export function cubicLength(c: Cubic, tolerance = 0.05): number {
  const points = flattenCubic(c, tolerance);
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}
