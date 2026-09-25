/**
 * The physics of a page turning, as plain numbers.
 *
 * A sheet hinges on its left edge (the spine). Its angle runs from 0, lying flat
 * over the page beneath, to -180, turned right over and out of view. Going
 * forward the page in view lifts from 0 towards -180; going back, the previous
 * page comes down from -180 to 0 over the one in view.
 *
 * A finger holds the page — the angle follows it — and letting go hands the page
 * to a spring that carries on at the finger's speed, so a flick turns a page
 * and a slow half-drag lets it fall back. Kept pure so the feel can be tuned and
 * tested without a screen.
 */

export type Dir = 1 | -1;

export const FLAT = 0;
export const TURNED = -180;

/** Paper: quick, with a touch of bounce as it lands. */
export const SPRING = { type: "spring", stiffness: 170, damping: 21, mass: 0.9 } as const;

/** A flick this fast (px per ms) decides the turn whatever the distance. */
const FLICK = 0.45;
/** Without a flick, the page must be carried this share of the way. */
const HALF = 0.35;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The sheet's angle for a drag of `dx` pixels across a page `width` wide. */
export function dragAngle(dir: Dir, dx: number, width: number): number {
  const share = clamp01((dir === 1 ? -dx : dx) / Math.max(1, width));
  return (dir === 1 ? TURNED * share : TURNED * (1 - share)) + 0; // + 0: never -0
}

/** Does letting go finish the turn? A flick decides; otherwise, far enough. */
export function completes(dir: Dir, dx: number, vx: number, width: number): boolean {
  const along = dir === 1 ? -vx : vx;
  if (along <= -FLICK) return false; // flicked back the way it came
  if (along >= FLICK) return true;
  return (dir === 1 ? -dx : dx) > width * HALF;
}

/** The finger's speed, in degrees a second, for the spring to carry on with. */
export const angularVelocity = (vx: number, width: number): number => (vx * 1000 * 180) / Math.max(1, width);

const lift = (angle: number) => Math.abs(Math.sin((angle * Math.PI) / 180));

/** Shade across the turning sheet: none flat, darkest edge-on to the light. */
export const shadeOf = (angle: number): number => 0.22 * lift(angle);

/** The shadow the lifted sheet casts on the page beneath, near the spine. */
export const castOf = (angle: number): number => 0.3 * lift(angle);

/** A slight curl as the sheet lifts: paper bends a little, it is not a board. */
export const curlOf = (angle: number): number => -2.5 * lift(angle);
