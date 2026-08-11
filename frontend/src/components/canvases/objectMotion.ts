/**
 * How a draggable object moves, in one place.
 *
 * Two problems this fixes, both of which a child feels rather than sees:
 *
 * - **Position.** Objects used to be placed with `left`/`top`, which the browser
 *   can only satisfy by running layout again — every pointer move, for every
 *   object on the stage. Placing them with the `translate` property instead
 *   keeps the whole drag on the compositor. `translate` is deliberately not
 *   `transform`: the objects also carry Tailwind's `scale-*` and the drop-pop
 *   keyframes, which own `transform`, and the two compose only if they stay on
 *   separate properties.
 *
 * - **Timing.** Every canvas had invented its own easing and duration — 0.25s
 *   here, 0.35s there — so the same apple settled at a different speed depending
 *   on the activity. There is one settle, and it is this one.
 */

import type { CSSProperties } from "react";

/**
 * The settle curve: a real damped spring, not an ease that resembles one.
 *
 * An object a child let go of has been *put down*, and the thing that reads as
 * having put something down is mass — it arrives, overshoots a little, and
 * comes to rest. A `cubic-bezier` ease-out arrives and stops dead, which is
 * why the old settle felt like sliding rather than dropping.
 *
 * Sampled from the standard damped harmonic oscillator (unit mass, stiffness
 * 380, damping 26 → ζ ≈ 0.67, ω₀ ≈ 19.5), which gives 6% overshoot and settles
 * in ~308ms. Expressed as `linear()` so the whole thing stays a CSS transition
 * on the compositor: a board can hold twenty objects, and running twenty JS
 * springs on a classroom tablet is exactly the cost this engine avoids.
 *
 * Regenerate rather than hand-tune — the numbers above are the source.
 */
export const SPRING_SETTLE =
  "linear(0, 0.0224, 0.0809, 0.1637, 0.2609, 0.3647, 0.469, 0.5693, 0.6621, 0.7456, " +
  "0.8184, 0.8803, 0.9314, 0.9723, 1.0039, 1.0272, 1.0433, 1.0535, 1.0587, 1.0601, " +
  "1.0586, 1.0549, 1.0499, 1.044, 1.0377, 1.0314, 1.0255, 1.0199, 1)";

/** How long that spring takes to come to rest. */
export const SETTLE_MS = 320;

/** Settle animation for an object that was let go. */
export const OBJECT_SETTLE =
  `translate ${SETTLE_MS}ms ${SPRING_SETTLE}, transform 0.15s ease, opacity 0.2s ease`;

/**
 * The same journey without the spring, for a child who has asked for less motion.
 *
 * Reduced motion is not *no* motion here: an object that teleports between two
 * places is harder to follow than one that travels, which is the opposite of
 * what the setting is for. It keeps the travel and drops the overshoot.
 */
export const OBJECT_SETTLE_REDUCED = "translate 0.12s ease-out, opacity 0.2s ease";

/**
 * How long a refused object shakes.
 *
 * A rejected drop used to settle back on exactly the curve an accepted one used,
 * so "wrong slot" and "right slot" looked identical and only the absence of a
 * badge told the child anything. Matches `.animate-shake` in `index.css`.
 */
export const REJECT_MS = 250;

export interface ObjectStyleOptions {
  /** Top-left, in stage pixels. */
  x: number;
  y: number;
  /** Edge length, in pixels. */
  size: number;
  dragging?: boolean;
  /** Stacking order when not being dragged. */
  z?: number;
  /** Honour the OS "reduce motion" setting — see `OBJECT_SETTLE_REDUCED`. */
  reducedMotion?: boolean;
}

/**
 * The inline style every draggable counting object uses.
 *
 * A dragged object gets no transition — it must sit exactly under the finger,
 * not chase it — and is promoted to its own layer for the duration.
 */
export const objectStyle = ({
  x,
  y,
  size,
  dragging = false,
  z = 20,
  reducedMotion = false
}: ObjectStyleOptions): CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  translate: `${x}px ${y}px`,
  width: `${size}px`,
  height: `${size}px`,
  zIndex: dragging ? 50 : z,
  transition: dragging ? "none" : reducedMotion ? OBJECT_SETTLE_REDUCED : OBJECT_SETTLE,
  willChange: dragging ? "translate" : undefined,
  touchAction: "none"
});
