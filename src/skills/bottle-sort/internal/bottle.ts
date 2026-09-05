export interface Box { left: number; top: number; width: number; height: number; }

/**
 * How a bottle leans to pour toward `dir` (1 right, -1 left).
 *
 * Two numbers found by looking at it rather than reasoning about it. At 58
 * degrees about the base the neck only swung sideways and still pointed
 * upward — a bottle knocked over, not poured. At 112 the lip landed exactly
 * right and the *rest* of the bottle swung up out of the rack entirely,
 * because rotating that far about the base throws everything above it.
 *
 * 72 degrees about the bottle's own middle leans it over the target with the
 * neck low, and keeps the body beside the rack where it belongs.
 */
export const POUR_ANGLE = 72;
/** Fraction of the bottle's height the tilt pivots on. */
export const PIVOT_Y = 0.5;

/** Where the tilt should put the lip, relative to the receiving mouth. */
const LIP_INSET = 10;
const LIP_RISE = 22;

const centre = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

/**
 * How far to shift a tilted bottle so its lip sits over the target's mouth.
 *
 * Rotation happens about the bottle's base, which moves the lip a long way; a
 * fixed percentage offset put it wherever the neighbour happened to be. This
 * rotates the lip about the same origin the CSS uses, then returns the
 * translation that carries it to the pouring position — so the answer is
 * derived rather than guessed, and can be checked without a browser.
 */
export function aimPour(source: Box, lip: Box, target: Box, dir: 1 | -1) {
  const angle = dir * POUR_ANGLE;
  const origin = { x: source.left + source.width * 0.5, y: source.top + source.height * PIVOT_Y };
  const from = centre(lip);
  const rad = (angle * Math.PI) / 180;
  const v = { x: from.x - origin.x, y: from.y - origin.y };
  const spun = {
    x: origin.x + v.x * Math.cos(rad) - v.y * Math.sin(rad),
    y: origin.y + v.x * Math.sin(rad) + v.y * Math.cos(rad),
  };
  const mouth = centre(target);
  const want = { x: mouth.x - dir * LIP_INSET, y: mouth.y - LIP_RISE };
  return { angle, dx: want.x - spun.x, dy: want.y - spun.y, lipAfter: want };
}

export interface Pt { x: number; y: number }

/** How wide the stream is where it leaves the lip, and where it lands. */
const STREAM_TOP = 4.4;
const STREAM_END = 2.1;
/** Points sampled along the arc when building the ribbon. */
const SAMPLES = 20;

/**
 * The shape of liquid falling from one mouth into another.
 *
 * The previous version bowed a quadratic between the two mouths with its
 * control point at their midpoint, which is the shape of a *rope*: it left the
 * lip diagonally and entered the target diagonally, so it lined up with
 * neither bottle. Liquid leaving a tipped bottle carries the lip's sideways
 * speed and then falls, and for a quadratic the tangents point at the control
 * point — so putting that control at (target.x, lip.y) is exactly a projectile
 * arc: horizontal out of the lip, vertical into the mouth.
 *
 * The ribbon around it is offset along each point's normal rather than
 * horizontally. That was the second half of the problem: a horizontal offset
 * is only correct where the stream falls straight down, and near the lip —
 * where the stream is nearly horizontal — it squeezed the ribbon flat.
 *
 * It also narrows as it goes, because falling liquid speeds up and the same
 * flow through a faster stream is a thinner one.
 */
export function streamPath(lip: Pt, target: Pt): { d: string; spine: string; length: number } {
  const ctrl = { x: target.x, y: lip.y };
  const at = (t: number): Pt => {
    const u = 1 - t;
    return {
      x: u * u * lip.x + 2 * u * t * ctrl.x + t * t * target.x,
      y: u * u * lip.y + 2 * u * t * ctrl.y + t * t * target.y,
    };
  };
  const tangent = (t: number): Pt => ({
    x: 2 * (1 - t) * (ctrl.x - lip.x) + 2 * t * (target.x - ctrl.x),
    y: 2 * (1 - t) * (ctrl.y - lip.y) + 2 * t * (target.y - ctrl.y),
  });

  const left: string[] = [];
  const right: string[] = [];
  let length = 0;
  let previous = at(0);

  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const p = at(t);
    length += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;

    const g = tangent(t);
    const len = Math.hypot(g.x, g.y) || 1;
    // Normal to the flow, so the ribbon keeps its thickness whichever way the
    // stream happens to be pointing at this sample.
    const nx = -g.y / len, ny = g.x / len;
    const w = STREAM_TOP + (STREAM_END - STREAM_TOP) * Math.pow(t, 0.7);

    left.push(`${(p.x + nx * w).toFixed(2)} ${(p.y + ny * w).toFixed(2)}`);
    right.push(`${(p.x - nx * w).toFixed(2)} ${(p.y - ny * w).toFixed(2)}`);
  }

  return {
    d: `M${left.join(" L")} L${right.reverse().join(" L")} Z`,
    spine: `M${lip.x.toFixed(2)} ${lip.y.toFixed(2)} Q${ctrl.x.toFixed(2)} ${ctrl.y.toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`,
    length,
  };
}
