/**
 * How the ring moves.
 *
 * A straight band between the tiles a child has chosen, and one gentle curve from
 * the last chosen tile to the fingertip. The fingertip end lags a little behind
 * the finger and the curve bows slightly away from a turn, then both settle.
 * That is all. A first version drew a verlet rope with sag; on a ring it
 * tangles — turn a corner and the chain folds back through itself, so the trace
 * reads as a knot instead of a path. Straight is not a simplification, it is the
 * correct picture of what a child is doing.
 *
 * Restraint is the design. Three damped springs and one Bézier:
 *
 *   tip spring   the drawn end chases the finger — stiff, so a little give
 *   bend spring  the curve's bow — capped, so the line can never cross itself
 *   tile springs a tile's pop on choosing, and its flinch on a wrong word
 *
 * Fixed 1/120s steps, accumulated, so it feels the same at 30fps and at 144fps;
 * a tab that was in the background resumes instead of exploding.
 *
 * Pure numbers in, numbers out. Nothing here touches a DOM node.
 */

import type { Pt } from "./traceModel";

export const TUNE = {
  /** The drawn tip chasing the finger. */
  tipK: 1700,
  tipRatio: 0.92,
  /** The curve's bow. */
  bendK: 300,
  bendRatio: 0.85,
  /** The most the curve may bow, in drawing units. */
  bendCap: 20,
  /** How much of the finger's sideways speed becomes bow. */
  whip: 0.12,
  /** A tile's scale and outward offset. */
  tileK: 420,
  /** Tiles re-orbiting after a shuffle. */
  angK: 90,
  angC: 12,
  /** The shuffle hub spinning. */
  hubK: 60,
  hubC: 9,
  /** Fixed step, and the most steps taken in one frame. */
  step: 1 / 120,
  maxSteps: 4,
} as const;

export type Tune = { -readonly [K in keyof typeof TUNE]: number };

/** Damping that just avoids oscillating, scaled by `ratio` (1 is critical). */
export const dampingFor = (k: number, ratio = 1): number => 2 * Math.sqrt(k) * ratio;

export interface Spring {
  x: number;
  v: number;
}

/** One semi-implicit Euler step of a damped spring toward `target`. */
export function stepSpring(s: Spring, target: number, k: number, c: number, dt: number): Spring {
  const v = s.v + (-k * (s.x - target) - c * s.v) * dt;
  return { x: s.x + v * dt, v };
}

export const isAtRest = (s: Spring, target: number, eps = 0.02): boolean => Math.abs(s.v) + Math.abs(s.x - target) < eps;

/** How many fixed steps this frame's elapsed time is worth, capped. */
export function substeps(elapsedSeconds: number, step: number = TUNE.step, maxSteps: number = TUNE.maxSteps): { count: number; dt: number } {
  const dt = Math.max(0, elapsedSeconds);
  const count = Math.min(maxSteps, Math.max(1, Math.ceil(dt / step)));
  return { count, dt: dt / count };
}

export interface Tip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bend: number;
  vBend: number;
}

export interface Pointer extends Pt {
  vx: number;
  vy: number;
}

export const tipAt = (p: Pt): Tip => ({ x: p.x, y: p.y, vx: 0, vy: 0, bend: 0, vBend: 0 });

/** The bow the curve wants, from the finger's speed across the line. Clamped. */
export function bendTarget(anchor: Pt, tip: Pt, pointerVelocity: Pt, whip: number, cap: number): number {
  const dx = tip.x - anchor.x;
  const dy = tip.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  const across = pointerVelocity.x * (-dy / len) + pointerVelocity.y * (dx / len);
  const want = -across * whip * 0.05;
  return Math.max(-cap, Math.min(cap, want));
}

/** One step of the drawn tip: lag toward the finger, bow away from a turn. */
export function stepTip(tip: Tip, pointer: Pointer, anchor: Pt | null, dt: number, tune: Tune): Tip {
  const cx = dampingFor(tune.tipK, tune.tipRatio);
  const vx = tip.vx + (-tune.tipK * (tip.x - pointer.x) - cx * tip.vx) * dt;
  const vy = tip.vy + (-tune.tipK * (tip.y - pointer.y) - cx * tip.vy) * dt;
  const x = tip.x + vx * dt;
  const y = tip.y + vy * dt;
  const want = anchor ? bendTarget(anchor, { x, y }, { x: pointer.vx, y: pointer.vy }, tune.whip, tune.bendCap) : 0;
  const b = stepSpring({ x: tip.bend, v: tip.vBend }, want, tune.bendK, dampingFor(tune.bendK, tune.bendRatio), dt);
  return { x, y, vx, vy, bend: b.x, vBend: b.v };
}

const f = (n: number) => n.toFixed(1);

/**
 * The trace as an SVG path: straight between chosen tiles, then — while a finger
 * is down — one quadratic curve to the drawn tip, bowed by `tip.bend`.
 */
export function tracePath(anchors: readonly Pt[], tip: Tip | null): string {
  if (!anchors.length) return "";
  let d = `M${f(anchors[0].x)} ${f(anchors[0].y)}`;
  for (let i = 1; i < anchors.length; i++) d += `L${f(anchors[i].x)} ${f(anchors[i].y)}`;
  if (tip) {
    const a = anchors[anchors.length - 1];
    const dx = tip.x - a.x;
    const dy = tip.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (a.x + tip.x) / 2 + (-dy / len) * tip.bend;
    const my = (a.y + tip.y) / 2 + (dx / len) * tip.bend;
    d += `Q${f(mx)} ${f(my)} ${f(tip.x)} ${f(tip.y)}`;
  }
  return d;
}
