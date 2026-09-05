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
