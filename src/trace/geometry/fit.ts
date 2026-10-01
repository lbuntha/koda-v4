/**
 * Fit cubic Béziers to points — Philip Schneider's algorithm ("An Algorithm for
 * Automatically Fitting Digitized Curves", Graphics Gems, 1990).
 *
 * Used by the Freehand Pen (a finger stroke becomes a few clean nodes), by
 * Simplify, and later by the vectoriser.
 */

import type { Cubic } from "./bezier";
import { derivCubic, evalCubic } from "./bezier";
import type { Point, TraceNode } from "./types";
import { add, cross, dist, dot, len, normalize, scale, sub } from "./vec";

export function fitCubics(input: Point[], maxError: number): Cubic[] {
  const points: Point[] = [];
  for (const p of input) {
    if (points.length === 0 || dist(points[points.length - 1], p) > 1e-6) points.push(p);
  }
  if (points.length < 2) return [];
  const leftTangent = normalize(sub(points[1], points[0]));
  const rightTangent = normalize(sub(points[points.length - 2], points[points.length - 1]));
  return fitRange(points, leftTangent, rightTangent, maxError);
}

function straight(a: Point, b: Point, t1: Point, t2: Point): Cubic {
  const d = dist(a, b) / 3;
  return [a, add(a, scale(t1, d)), add(b, scale(t2, d)), b];
}

function fitRange(points: Point[], t1: Point, t2: Point, error: number): Cubic[] {
  if (points.length === 2) return [straight(points[0], points[1], t1, t2)];

  let u = chordLengths(points);
  let bez = generate(points, u, t1, t2);
  let [maxError, split] = maxDistance(points, bez, u);
  if (maxError < error) return [bez];

  if (maxError < error * 4) {
    for (let i = 0; i < 20; i++) {
      const next = reparameterize(bez, points, u);
      bez = generate(points, next, t1, t2);
      [maxError, split] = maxDistance(points, bez, next);
      if (maxError < error) return [bez];
      u = next;
    }
  }

  let center = normalize(sub(points[split - 1], points[split + 1]));
  if (len(center) === 0) center = normalize(sub(points[split - 1], points[split]));
  const left = fitRange(points.slice(0, split + 1), t1, center, error);
  const right = fitRange(points.slice(split), scale(center, -1), t2, error);
  return [...left, ...right];
}

function chordLengths(points: Point[]): number[] {
  const u = [0];
  for (let i = 1; i < points.length; i++) u.push(u[i - 1] + dist(points[i], points[i - 1]));
  const total = u[u.length - 1];
  return u.map((v) => (total === 0 ? 0 : v / total));
}

function generate(points: Point[], u: number[], t1: Point, t2: Point): Cubic {
  const first = points[0];
  const last = points[points.length - 1];
  const c = [
    [0, 0],
    [0, 0],
  ];
  const x = [0, 0];
  for (let i = 0; i < points.length; i++) {
    const t = u[i];
    const s = 1 - t;
    const b0 = s * s * s;
    const b1 = 3 * t * s * s;
    const b2 = 3 * t * t * s;
    const b3 = t * t * t;
    const a1 = scale(t1, b1);
    const a2 = scale(t2, b2);
    c[0][0] += dot(a1, a1);
    c[0][1] += dot(a1, a2);
    c[1][0] = c[0][1];
    c[1][1] += dot(a2, a2);
    const tmp = sub(points[i], add(scale(first, b0 + b1), scale(last, b2 + b3)));
    x[0] += dot(a1, tmp);
    x[1] += dot(a2, tmp);
  }
  const detC = c[0][0] * c[1][1] - c[1][0] * c[0][1];
  const detX1 = x[0] * c[1][1] - x[1] * c[0][1];
  const detX2 = c[0][0] * x[1] - c[1][0] * x[0];
  const alphaL = detC === 0 ? 0 : detX1 / detC;
  const alphaR = detC === 0 ? 0 : detX2 / detC;
  const segLength = dist(first, last);
  const epsilon = 1e-6 * segLength;
  if (alphaL < epsilon || alphaR < epsilon) return straight(first, last, t1, t2);
  return [first, add(first, scale(t1, alphaL)), add(last, scale(t2, alphaR)), last];
}

function maxDistance(points: Point[], bez: Cubic, u: number[]): [number, number] {
  let max = 0;
  let split = Math.floor(points.length / 2);
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist(evalCubic(bez, u[i]), points[i]);
    if (d > max) {
      max = d;
      split = i;
    }
  }
  return [max, Math.min(points.length - 2, Math.max(1, split))];
}

function reparameterize(bez: Cubic, points: Point[], u: number[]): number[] {
  return u.map((t, i) => newton(bez, points[i], t));
}

function newton(q: Cubic, p: Point, t: number): number {
  const d = sub(evalCubic(q, t), p);
  const q1 = derivCubic(q, t);
  // Second derivative.
  const s = 1 - t;
  const q2 = {
    x: 6 * s * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x),
    y: 6 * s * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y),
  };
  const numerator = dot(d, q1);
  const denominator = dot(q1, q1) + dot(d, q2);
  if (denominator === 0) return t;
  const next = t - numerator / denominator;
  return next < 0 ? 0 : next > 1 ? 1 : next;
}

/** Cubics joined end to start, as stroke nodes. A join whose tangents line up is `smooth`. */
export function cubicsToNodes(cubics: Cubic[]): TraceNode[] {
  if (cubics.length === 0) return [];
  const nodes: TraceNode[] = [];
  const handle = (from: Point, to: Point) => {
    const h = sub(to, from);
    return len(h) < 1e-6 ? undefined : { dx: h.x, dy: h.y };
  };
  cubics.forEach((c, i) => {
    const out = handle(c[0], c[1]);
    if (i === 0) nodes.push({ x: c[0].x, y: c[0].y, type: "corner", out });
    else nodes[i].out = out;
    nodes.push({ x: c[3].x, y: c[3].y, type: "corner", in: handle(c[3], c[2]) });
  });
  for (const node of nodes) {
    if (node.in && node.out) {
      const a = normalize({ x: -node.in.dx, y: -node.in.dy });
      const b = normalize({ x: node.out.dx, y: node.out.dy });
      if (Math.abs(cross(a, b)) < 0.17 && dot(a, b) > 0) node.type = "smooth";
    }
  }
  return nodes;
}

/** A finger stroke (or any polyline) as a few clean nodes, within `maxError` units. */
export function fitNodes(points: Point[], maxError = 4): TraceNode[] {
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y, type: "corner" }];
  return cubicsToNodes(fitCubics(points, maxError));
}
